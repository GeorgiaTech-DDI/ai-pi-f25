import { useState } from 'react';
import { Analytics } from "@vercel/analytics/react"
export default function Home() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contexts, setContexts] = useState([]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setAnswer('');
    setContexts([]);

    // check if localhost
    try {

      if (window.location.hostname === 'localhost') {
        setAnswer("This is a test answer");
        setContexts([
          { "id": "60", "score": 0.549824595, "values": [], "metadata": { "chunk_idx": 60, "filename": "Waterjet-Required&Optional.md", "original_idx": "0", "text": "[CLS] mark the machine down and contact a waterjet master / apprentice. * protomax specific steps * * image of disconnecting from the nozzle. * * image of disconnecting from the hopper. * * image of using compressed air. * * image : caption explains how to check for garnet flow on the protomax. * # # what files can be used * the waterjets natively support * *. dxf * * files. * if a user has a different file type, have them convert it to. dxf using inkscape on the laser computers. # # waterjet brick & alternatives ( bonus ) * * * waterjet bricks : * * located next to the pump of the larger waterjet. [SEP]", "total_chunks": 72 } },
          { "id": "0", "score": 0.463381, "values": [], "metadata": { "chunk_idx": 0, "filename": "Waterjet-Required&Optional.md", "original_idx": "0", "text": "[CLS] # waterjet - required & optional this document covers operation of the maxiem, globalmax, and protomax waterjet cutters, including handling brittle materials, clearing clogs, using the saw mode, and etching / scribing", "total_chunks": 72 } }
        ]);
      } else {
        const response = await fetch('/api/rag', { // Calls your Vercel Serverless Function
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ question }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setAnswer(data.answer);
        setContexts(data.contexts || []);
      }
    } catch (e) {
      setError('Failed to get answer. Please try again.');
      console.error("Frontend error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <Analytics />
      <h1>AI PI</h1>
      <p className="disclaimer">
        This is an AI-powered assistant. While we strive for accuracy, responses may not always be correct.
        Please verify important information from reliable sources.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ask your question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Get Answer'}
        </button>
      </form>

      {error && <p className="error">Error: {error}</p>}
      {answer && (
        <div className="answer-container">
          <h2>Answer:</h2>
          <p>{answer}</p>
        </div>
      )}

      {contexts.length > 0 && (
        <div className="contexts-container">
          <h3>Reference Sources:</h3>
          {Object.entries(
            contexts.reduce((acc, context) => {
              const filename = context.metadata?.filename || `Reference ${Object.keys(acc).length + 1}`;
              if (!acc[filename]) {
                acc[filename] = [];
              }
              acc[filename].push(context);
              return acc;
            }, {})
          ).map(([filename, fileContexts], index) => (
            <details key={index} className="context-accordion">
              <summary>{filename}</summary>
              <div className="context-content">
                {fileContexts.map((context, contextIndex) => (
                  <p key={contextIndex}>
                    {(context.metadata.text || JSON.stringify(context))}
                  </p>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      <style jsx>{`
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
        }
        input[type="text"] {
          padding: 10px;
          margin-right: 10px;
          border: 1px solid #ccc;
          border-radius: 5px;
          flex-grow: 1;
        }
        button {
          padding: 10px 20px;
          border: none;
          border-radius: 5px;
          background-color: #0070f3;
          color: white;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        button:hover {
          background-color: #0050c8;
        }
        button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        .answer-container {
          margin-top: 20px;
          padding: 15px;
          border: 1px solid #eee;
          border-radius: 5px;
          background-color: #f9f9f9;
        }
        .error {
          color: red;
          margin-top: 10px;
        }
        .disclaimer {
          font-size: 0.9rem;
          color: #666;
          background-color: #f5f5f5;
          padding: 10px;
          border-radius: 5px;
          margin: 10px 0 20px;
          text-align: center;
          max-width: 600px;
        }
        .contexts-container {
          margin-top: 20px;
          width: 100%;
          max-width: 800px;
        }
        .context-accordion {
          margin-bottom: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
          overflow: hidden;
        }
        .context-accordion summary {
          padding: 10px;
          background-color: #f1f1f1;
          cursor: pointer;
          font-weight: bold;
        }
        .context-content {
          padding: 10px;
          background-color: #fafafa;
        }
      `}</style>
    </div>
  );
}
