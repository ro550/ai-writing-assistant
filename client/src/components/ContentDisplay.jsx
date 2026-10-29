// client/src/components/ContentDisplay.jsx
import { useState } from 'react';

function ContentDisplay({ content, isLoading, onSave }) {
  const [draftTitle, setDraftTitle] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  if (isLoading) {
    return (
      <div className="content-display loading">
        <div className="spinner" />
        <p>Generating content...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="content-display empty">
        <p>Your generated content will appear here.</p>
        <p>Fill in the form on the left and click Generate.</p>
      </div>
    );
  }

  const handleSave = () => {
    if (!draftTitle.trim()) return;
    onSave(draftTitle);
    setDraftTitle('');
    setShowSaveForm(false);
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([content.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-content.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="content-display">
      <div className="content-header">
        <h3>Generated Content</h3>
        <div className="content-meta">
          <span>Provider: {content.provider}</span>
          <span>Tokens: {content.usage?.total || 0}</span>
        </div>
      </div>

      <div className="content-body">
        <pre>{content.content}</pre>
      </div>

      <div className="content-actions">
        <button onClick={() => setShowSaveForm(true)}>Save Draft</button>
        <button onClick={handleExportMarkdown}>Export Markdown</button>
        <button onClick={() => navigator.clipboard.writeText(content.content)}>
          Copy to Clipboard
        </button>
      </div>

      {showSaveForm && (
        <div className="save-form">
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Draft title..."
          />
          <button onClick={handleSave} disabled={!draftTitle.trim()}>
            Save
          </button>
          <button onClick={() => setShowSaveForm(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default ContentDisplay;