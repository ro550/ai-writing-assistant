// server/db.js
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'writing-assistant.db'));

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL,
    tone TEXT NOT NULL,
    topic TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    tokens_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    draft_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (draft_id) REFERENCES drafts(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );
`);

// Prepared statements for common operations
const insertDraft = db.prepare(`
  INSERT INTO drafts (id, title, content, content_type, tone, topic, provider, model, tokens_used)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getDrafts = db.prepare(`
  SELECT * FROM drafts ORDER BY updated_at DESC
`);

const getDraftById = db.prepare(`
  SELECT * FROM drafts WHERE id = ?
`);

const updateDraft = db.prepare(`
  UPDATE drafts SET content = ?, updated_at = datetime('now') WHERE id = ?
`);

const deleteDraft = db.prepare(`
  DELETE FROM drafts WHERE id = ?
`);

const insertConversation = db.prepare(`
  INSERT INTO conversations (id, draft_id) VALUES (?, ?)
`);

const insertMessage = db.prepare(`
  INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)
`);

const getConversationMessages = db.prepare(`
  SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC
`);

module.exports = {
  db,
  insertDraft,
  getDrafts,
  getDraftById,
  updateDraft,
  deleteDraft,
  insertConversation,
  insertMessage,
  getConversationMessages,
};