// client/src/components/DraftList.jsx
import { useState, useEffect } from 'react';

function DraftList() {
  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/drafts');
      const data = await response.json();
      setDrafts(data.drafts);
    } catch (error) {
      console.error('Failed to fetch drafts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;

    try {
      await fetch(`http://localhost:3001/api/drafts/${id}`, { method: 'DELETE' });
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      if (selectedDraft?.id === id) setSelectedDraft(null);
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
  };

  if (isLoading) return <p>Loading drafts...</p>;

  return (
    <div className="drafts-layout">
      <div className="drafts-list">
        <h3>Saved Drafts ({drafts.length})</h3>
        {drafts.length === 0 ? (
          <p>No drafts saved yet. Generate some content and save it.</p>
        ) : (
          <ul>
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className={selectedDraft?.id === draft.id ? 'selected' : ''}
                onClick={() => setSelectedDraft(draft)}
              >
                <strong>{draft.title}</strong>
                <span className="draft-meta">
                  {draft.content_type} | {draft.tone} | {new Date(draft.created_at).toLocaleDateString()}
                </span>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(draft.id);
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="draft-preview">
        {selectedDraft ? (
          <>
            <h3>{selectedDraft.title}</h3>
            <div className="draft-meta-bar">
              <span>Type: {selectedDraft.content_type}</span>
              <span>Tone: {selectedDraft.tone}</span>
              <span>Provider: {selectedDraft.provider || 'N/A'}</span>
              <span>Tokens: {selectedDraft.tokens_used}</span>
            </div>
            <pre>{selectedDraft.content}</pre>
          </>
        ) : (
          <p>Select a draft to preview it.</p>
        )}
      </div>
    </div>
  );
}

export default DraftList;