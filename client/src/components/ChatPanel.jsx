// client/src/components/ChatPanel.jsx
import { useState } from 'react';

function ChatPanel({ onSendMessage, isLoading }) {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage('');

    setChatHistory((prev) => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await onSendMessage(userMessage);
      if (response) {
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', content: 'Content updated based on your feedback.' },
        ]);
      }
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: 'error', content: 'Failed to process your message. Please try again.' },
      ]);
    }
  };

  return (
    <div className="chat-panel">
      <h4>Refine Your Content</h4>
      <p className="chat-hint">
        Ask for changes like "Make it shorter", "Add more detail about pricing",
        or "Change the tone to be more formal"
      </p>

      {chatHistory.length > 0 && (
        <div className="chat-history">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>
              <span>{msg.content}</span>
            </div>
          ))}
        </div>
      )}

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g., Make it more concise and add a call-to-action"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !message.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatPanel;