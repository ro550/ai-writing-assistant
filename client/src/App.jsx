// client/src/App.jsx
import { useState } from 'react';
import GenerateForm from './components/GenerateForm';
import ContentDisplay from './components/ContentDisplay';
import ChatPanel from './components/ChatPanel';
import DraftList from './components/DraftList';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('generate');
  const [generatedContent, setGeneratedContent] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async (formData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await response.json();
      setGeneratedContent(data);
      setConversationId(data.conversationId);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatMessage = async (message) => {
    if (!conversationId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Chat failed');
      }

      const data = await response.json();
      setGeneratedContent(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async (title) => {
    if (!generatedContent) return;

    try {
      const response = await fetch('http://localhost:3001/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: generatedContent.content,
          contentType: generatedContent.contentType || 'blog',
          tone: generatedContent.tone || 'casual',
          topic: generatedContent.topic || '',
          provider: generatedContent.provider,
          model: generatedContent.model,
          tokensUsed: generatedContent.usage?.total || 0,
        }),
      });

      if (!response.ok) throw new Error('Failed to save draft');
      alert('Draft saved successfully!');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Writing Assistant</h1>
        <p>Generate blog posts, emails, and social media content with AI</p>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === 'generate' ? 'active' : ''}
          onClick={() => setActiveTab('generate')}
        >
          Generate
        </button>
        <button
          className={activeTab === 'drafts' ? 'active' : ''}
          onClick={() => setActiveTab('drafts')}
        >
          Saved Drafts
        </button>
      </nav>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {activeTab === 'generate' && (
        <div className="generate-layout">
          <div className="left-panel">
            <GenerateForm onGenerate={handleGenerate} isLoading={isLoading} />

            {generatedContent && (
              <ChatPanel
                onSendMessage={handleChatMessage}
                isLoading={isLoading}
              />
            )}
          </div>

          <div className="right-panel">
            <ContentDisplay
              content={generatedContent}
              isLoading={isLoading}
              onSave={handleSaveDraft}
            />
          </div>
        </div>
      )}

      {activeTab === 'drafts' && <DraftList />}
    </div>
  );
}

export default App;