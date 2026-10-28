
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { generateResponse } = require('./llm');
const { getSystemPrompt, buildGenerationPrompt, LENGTH_CONFIG } = require('./prompts');
const {
  db,
  insertDraft,
  getDrafts,
  getDraftById,
  updateDraft,
  deleteDraft,
  insertConversation,
  insertMessage,
  getConversationMessages,
} = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Define allowed input values and limits for API requests.
const VALID_TYPES = ['blog', 'email', 'social'];
const VALID_TONES = ['formal', 'casual', 'persuasive'];
const VALID_LENGTHS = ['short', 'medium', 'long'];
const MAX_TOPIC_LENGTH = 2000;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;
const CHAT_MAX_TOKENS = 3000;

// Prepare database statements for linking conversations to saved drafts.
const linkConversationToDraft = db.prepare(
  'UPDATE conversations SET draft_id = ? WHERE id = ?'
);
const unlinkConversationsFromDraft = db.prepare(
  'UPDATE conversations SET draft_id = NULL WHERE draft_id = ?'
);
const getConversationForDraft = db.prepare(
  'SELECT id FROM conversations WHERE draft_id = ? ORDER BY created_at DESC LIMIT 1'
);

// Save a draft and its conversation link in a single database transaction.
const saveDraftTransaction = db.transaction((id, fields, conversationId) => {
  insertDraft.run(
    id,
    fields.title,
    fields.content,
    fields.contentType,
    fields.tone,
    fields.topic,
    fields.provider,
    fields.model,
    fields.tokensUsed
  );
  if (conversationId) linkConversationToDraft.run(id, conversationId);
});

// Remove conversation references before deleting a draft to maintain referential integrity.
const deleteDraftTransaction = db.transaction((id) => {
  unlinkConversationsFromDraft.run(id);
  deleteDraft.run(id);
});

// Identify temporary AI provider and network errors that may succeed on retry.
const RETRYABLE_STATUS = [429, 503, 529];
const RETRYABLE_NETWORK_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'];

function isRetryable(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.code);
  if (RETRYABLE_STATUS.includes(status)) return true;
  if (RETRYABLE_NETWORK_CODES.includes(error?.code)) return true;
  return /high demand|overloaded|unavailable|rate limit|try again later/i.test(
    error?.message || ''
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry temporary AI failures with an increasing delay between attempts.
async function generateWithRetry(options, retries = 3) {
  let delay = 1000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await generateResponse(options);
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) throw error;
      console.warn(
        `LLM call failed (${error.message}). Retrying in ${delay}ms (${attempt + 1}/${retries})`
      );
      await sleep(delay);
      delay *= 2;
    }
  }
}

// Convert AI provider failures into HTTP responses
function sendLlmError(res, error, fallbackMessage) {
  console.error('LLM error:', error);

  if (error?.message?.startsWith('Unsupported provider')) {
    return res.status(400).json({ error: error.message });
  }
  if (isRetryable(error)) {
    return res.status(503).json({
      error: 'The AI service is busy right now. Please try again in a moment.',
      retryable: true,
    });
  }
  return res.status(500).json({ error: fallbackMessage });
}

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Generate content endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const {
      topic,
      contentType = 'blog',
      tone = 'casual',
      length = 'medium',
      provider,
    } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'Topic is required.' });
    }
    if (topic.length > MAX_TOPIC_LENGTH) {
      return res.status(400).json({
        error: `Topic is too long (max ${MAX_TOPIC_LENGTH} characters).`,
      });
    }
    if (!VALID_TYPES.includes(contentType)) {
      return res.status(400).json({
        error: `Invalid content type. Use: ${VALID_TYPES.join(', ')}`,
      });
    }
    if (!VALID_TONES.includes(tone)) {
      return res.status(400).json({
        error: `Invalid tone. Use: ${VALID_TONES.join(', ')}`,
      });
    }
    if (!VALID_LENGTHS.includes(length)) {
      return res.status(400).json({
        error: `Invalid length. Use: ${VALID_LENGTHS.join(', ')}`,
      });
    }

    const cleanTopic = topic.trim();
    const systemPrompt = getSystemPrompt(contentType, tone);
    const userPrompt = buildGenerationPrompt(cleanTopic, contentType, tone, length);
    const lengthConfig = LENGTH_CONFIG[length];

    const response = await generateWithRetry({
      provider,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
      maxTokens: lengthConfig.maxTokens,
    });

    // Store the conversation only after content generation succeeds.
    const conversationId = uuidv4();
    insertConversation.run(conversationId, null);
    insertMessage.run(conversationId, 'user', userPrompt);
    insertMessage.run(conversationId, 'assistant', response.text);

    res.json({
      content: response.text,
      conversationId,
      topic: cleanTopic,
      contentType,
      tone,
      length,
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      finished: response.finished,
    });
  } catch (error) {
    sendLlmError(res, error, 'Failed to generate content. Please try again.');
  }
});

// Continue an existing conversation to refine previously generated content.
app.post('/api/chat', async (req, res) => {
  try {
    const { conversationId, message, provider, contentType, tone } = req.body;

    if (!conversationId || !message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        error: 'conversationId and message are required.',
      });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
      });
    }

    const history = getConversationMessages.all(conversationId);
    if (history.length === 0) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const cleanMessage = message.trim();
    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: cleanMessage },
    ];

    // Preserve the original content format and tone when building the follow-up prompt.
    const basePrompt =
      VALID_TYPES.includes(contentType) && VALID_TONES.includes(tone)
        ? getSystemPrompt(contentType, tone)
        : 'You are a professional content writer.';
    const system = `${basePrompt}

The user is refining content you previously wrote. Apply their feedback and return the complete updated content, not just the changes. Keep the same content type and tone unless they ask you to change them.`;

    const response = await generateWithRetry({
      provider,
      system,
      messages,
      temperature: 0.7,
      maxTokens: CHAT_MAX_TOKENS,
    });

    // Persist the new messages only after the AI response succeeds.
    insertMessage.run(conversationId, 'user', cleanMessage);
    insertMessage.run(conversationId, 'assistant', response.text);

    res.json({
      content: response.text,
      conversationId,
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      finished: response.finished,
    });
  } catch (error) {
    sendLlmError(res, error, 'Failed to process message. Please try again.');
  }
});

// Validate and save a draft
app.post('/api/drafts', (req, res) => {
  try {
    const {
      title,
      content,
      contentType,
      tone,
      topic,
      provider,
      model,
      tokensUsed,
      conversationId,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      return res.status(400).json({
        error: `Title is too long (max ${MAX_TITLE_LENGTH} characters).`,
      });
    }
    if (contentType && !VALID_TYPES.includes(contentType)) {
      return res.status(400).json({
        error: `Invalid content type. Use: ${VALID_TYPES.join(', ')}`,
      });
    }
    if (tone && !VALID_TONES.includes(tone)) {
      return res.status(400).json({
        error: `Invalid tone. Use: ${VALID_TONES.join(', ')}`,
      });
    }
    if (conversationId && getConversationMessages.all(conversationId).length === 0) {
      return res.status(400).json({ error: 'Unknown conversationId.' });
    }

    const id = uuidv4();
    saveDraftTransaction(
      id,
      {
        title: title.trim(),
        content,
        contentType: contentType || 'blog',
        tone: tone || 'casual',
        topic: topic || '',
        provider: provider || null,
        model: model || null,
        tokensUsed: Number(tokensUsed) || 0,
      },
      conversationId
    );

    res.status(201).json({ id, message: 'Draft saved successfully.' });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save draft.' });
  }
});

// Return all saved drafts.
app.get('/api/drafts', (req, res) => {
  try {
    res.json({ drafts: getDrafts.all() });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch drafts.' });
  }
});

// Retrieve a draft and the ID of its associated conversation, if available.
app.get('/api/drafts/:id', (req, res) => {
  try {
    const draft = getDraftById.get(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found.' });
    }
    const conversation = getConversationForDraft.get(req.params.id);
    res.json({ draft, conversationId: conversation ? conversation.id : null });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch draft.' });
  }
});

// Validate and update the content of an existing draft.
app.patch('/api/drafts/:id', (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Content is required.' });
    }

    const draft = getDraftById.get(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found.' });
    }

    updateDraft.run(content, req.params.id);
    res.json({ message: 'Draft updated successfully.' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update draft.' });
  }
});

// Delete a draft and remove any conversation references to it.
app.delete('/api/drafts/:id', (req, res) => {
  try {
    const draft = getDraftById.get(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found.' });
    }

    deleteDraftTransaction(req.params.id);
    res.json({ message: 'Draft deleted successfully.' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete draft.' });
  }
});

// Error handling for unexpected errors
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Handle malformed JSON and unexpected errors across the application.
 // eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI Writing Assistant API running on http://localhost:${PORT}`);
});
