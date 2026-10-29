// client/src/components/GenerateForm.jsx
import { useState } from 'react';

function GenerateForm({ onGenerate, isLoading }) {
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] = useState('blog');
  const [tone, setTone] = useState('casual');
  const [length, setLength] = useState('medium');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onGenerate({ topic, contentType, tone, length });
  };

  return (
    <form className="generate-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="topic">Topic or Brief</label>
        <textarea
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., Benefits of mobile banking for small businesses in Kenya"
          rows={3}
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="contentType">Content Type</label>
          <select
            id="contentType"
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
          >
            <option value="blog">Blog Post</option>
            <option value="email">Email</option>
            <option value="social">Social Media Post</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="tone">Tone</label>
          <select
            id="tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
          >
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
            <option value="persuasive">Persuasive</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="length">Length</label>
          <select
            id="length"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          >
            <option value="short">Short (150-250 words)</option>
            <option value="medium">Medium (400-600 words)</option>
            <option value="long">Long (800-1200 words)</option>
          </select>
        </div>
      </div>

      <button type="submit" disabled={isLoading || !topic.trim()}>
        {isLoading ? 'Generating...' : 'Generate Content'}
      </button>
    </form>
  );
}

export default GenerateForm;