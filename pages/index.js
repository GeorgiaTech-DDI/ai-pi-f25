import { useState } from 'react';

export default function Home() {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setAnswer('');

        try {
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
        } catch (e) {
            setError('Failed to get answer. Please try again.');
            console.error("Frontend error:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <h1>RAG Model Interface</h1>
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
      `}</style>
        </div>
    );
}
