// server/prompts.js

const TONE_DESCRIPTIONS = {
  formal: 'Professional, polished, and authoritative. Use proper grammar, avoid slang, and maintain a serious but approachable tone.',
  casual: 'Friendly, conversational, and relaxed. Write like you are talking to a friend. Use contractions and a warm tone.',
  persuasive: 'Compelling, action-oriented, and convincing. Use strong verbs, address the reader directly, and include clear calls to action.',
};

const LENGTH_CONFIG = {
  short: { words: '150-250', maxTokens: 500 },
  medium: { words: '400-600', maxTokens: 1000 },
  long: { words: '800-1200', maxTokens: 2000 },
};

function getSystemPrompt(contentType, tone) {
  const toneDescription = TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.casual;

  const basePrompt = `You are a professional content writer. You create high-quality, original content that engages readers and achieves the writer's goals.

Tone: ${toneDescription}

Writing rules:
- Write original, engaging content
- Use clear, concise language
- Include relevant examples and details
- Avoid filler phrases and unnecessary repetition
- Make every sentence count`;

  switch (contentType) {
    case 'blog':
      return `${basePrompt}

Content type: Blog Post
- Include an engaging headline
- Use subheadings to break up the content
- Write an attention-grabbing opening paragraph
- Include practical examples or actionable advice
- End with a conclusion or call-to-action
- Use Kenyan context and examples where relevant`;

    case 'email':
      return `${basePrompt}

Content type: Email
- Include a clear subject line
- Open with an appropriate greeting
- State the purpose in the first paragraph
- Keep paragraphs short (2-3 sentences max)
- Include a clear call-to-action or next step
- Close with an appropriate sign-off`;

    case 'social':
      return `${basePrompt}

Content type: Social Media Post
- Write for maximum engagement
- Use hooks to grab attention in the first line
- Include relevant hashtags (3-5)
- Keep sentences short and punchy
- Optimized for the Kenyan/East African audience
- If appropriate, include a call-to-action (follow, share, comment)`;

    default:
      return basePrompt;
  }
}

function buildGenerationPrompt(topic, contentType, tone, length) {
  const lengthConfig = LENGTH_CONFIG[length] || LENGTH_CONFIG.medium;

  return `Write a ${contentType === 'blog' ? 'blog post' : contentType === 'email' ? 'professional email' : 'social media post'} about the following topic.

Topic: ${topic}

Target length: approximately ${lengthConfig.words} words.

Write the content now.`;
}

module.exports = {
  getSystemPrompt,
  buildGenerationPrompt,
  LENGTH_CONFIG,
  TONE_DESCRIPTIONS,
};