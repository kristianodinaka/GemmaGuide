import React, { useState, useEffect } from 'react';

const BACKEND_URL = 'https://student-ai-decision-support.onrender.com';

export default function App() {
  // Navigation / Router State: 'login' | 'dashboard' | 'analysis' | 'results'
  const [currentPage, setCurrentPage] = useState('login');
  
  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Analysis State
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']); // Starts with 2 options
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // Results State
  const [activeAnalysis, setActiveAnalysis] = useState(null);

  // History State
  const [history, setHistory] = useState([]);

  // Check for active session on load
  useEffect(() => {
    const sessionUser = localStorage.getItem('currentUser');
    if (sessionUser) {
      setCurrentUser(sessionUser);
      setCurrentPage('dashboard');
      loadHistory(sessionUser);
    }
  }, []);

  // Load history from localStorage for a specific user
  const loadHistory = (user) => {
    try {
      const allAnalyses = JSON.parse(localStorage.getItem('analyses') || '[]');
      const userAnalyses = allAnalyses.filter(item => item.username === user);
      // Sort by timestamp descending
      userAnalyses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setHistory(userAnalyses);
    } catch (e) {
      console.error('Failed to load history', e);
      setHistory([]);
    }
  };

  // Auth Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const username = usernameInput.trim();
    const password = passwordInput.trim();

    if (!username || !password) {
      setAuthError('Please fill in both fields.');
      return;
    }

    

    if (authMode === 'register') {
      // Register logic
      try {
        const response = await fetch(`${BACKEND_URL}/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setAuthError(data.error || "Registration failed");
          return;
        }

        setAuthSuccess("Registration successful! Please log in.");
        setAuthMode("login");
        setPasswordInput("");

      } catch (err) {
        setAuthError("Failed to connect to server");
      }
    } else {
        console.log("Login button clicked");
        try {
           console.log("Sending login request");
          const response = await fetch(`${BACKEND_URL}/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username,
              password,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            setAuthError(data.error || "Invalid username or password.");
            return;
          }

          localStorage.setItem('currentUser', data.username);
          setCurrentUser(data.username);
          setUsernameInput('');
          setPasswordInput('');
          loadHistory(data.username);
          setCurrentPage('dashboard');

        } catch (err) {
          setAuthError("Login failed");
        }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setCurrentPage('login');
    setAuthSuccess('');
    setAuthError('');
    setQuestion('');
    setOptions(['', '']);
  };

  // Dynamic Options Manipulation
  const handleAddOption = () => {
    if (options.length < 5) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (indexToRemove) => {
    if (options.length > 2) {
      setOptions(options.filter((_, idx) => idx !== indexToRemove));
    }
  };

  const handleOptionChange = (value, idx) => {
    const newOptions = [...options];
    newOptions[idx] = value;
    setOptions(newOptions);
  };

  // Submit options for AI analysis
  const handleAnalyze = async (e) => {
    e.preventDefault();
    setAnalysisError('');

    const cleanQuestion = question.trim();
    const cleanOptions = options.map(opt => opt.trim()).filter(opt => opt.length > 0);

    if (!cleanQuestion) {
      setAnalysisError('Please enter a decision question.');
      return;
    }

    if (cleanOptions.length < 2) {
      setAnalysisError('Please enter at least two options to analyze.');
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: cleanQuestion,
          options: cleanOptions
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server returned an error.');
      }

      // We expect data to be structured as: { rankings: [...], finalRecommendation: "..." }
      if (!data.rankings || !Array.isArray(data.rankings) || !data.finalRecommendation) {
        throw new Error('AI response did not match the expected structure.');
      }

      const timestamp = new Date().toISOString();
      const newAnalysis = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        username: currentUser,
        question: cleanQuestion,
        options: cleanOptions,
        response: data,
        timestamp
      };

      // Save to local storage history
      let allAnalyses = [];
      try {
        allAnalyses = JSON.parse(localStorage.getItem('analyses') || '[]');
      } catch (err) {
        allAnalyses = [];
      }
      allAnalyses.push(newAnalysis);
      localStorage.setItem('analyses', JSON.stringify(allAnalyses));

      // Update state and transition to Results
      setActiveAnalysis(newAnalysis);
      loadHistory(currentUser);
      setCurrentPage('results');

      // Clear analysis page inputs
      setQuestion('');
      setOptions(['', '']);

    } catch (err) {
      console.error(err);
      setAnalysisError(err.message || 'Unable to connect to the backend server.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // View past history analysis detail
  const handleViewHistoryItem = (item) => {
    setActiveAnalysis(item);
    setCurrentPage('results');
  };

  // Date formatter helper
  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  return (
    <div className="app-container">

      {/* ── Site Header ── */}
      <header>
        <div className="system-title">Decision Support</div>
        <div className="system-subtitle">Student AI Decision Support System</div>
      </header>

      {/* ── Navigation for logged-in users ── */}
      {currentUser && (
        <div className="nav-bar">
          <span className="user-badge">Signed in as {currentUser}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {currentPage !== 'dashboard' && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setCurrentPage('dashboard');
                  setAnalysisError('');
                }}
              >
                Dashboard
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleLogout}>Log Out</button>
          </div>
        </div>
      )}

      {/* ── Main Routing Views ── */}
      <main>

        {/* ────────────────────────────────────────
            VIEW 1: LOGIN / REGISTER
        ──────────────────────────────────────── */}
        {currentPage === 'login' && (
          <div style={{ maxWidth: '400px', margin: '48px auto 0' }}>
            <div className="card">

              <div className="auth-tabs">
                <div
                  className={`auth-tab${authMode === 'login' ? ' active' : ''}`}
                  onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
                >
                  Log In
                </div>
                <div
                  className={`auth-tab${authMode === 'register' ? ' active' : ''}`}
                  onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}
                >
                  Register
                </div>
              </div>

              {authError && <div className="callout callout-error">{authError}</div>}
              {authSuccess && <div className="callout callout-success">{authSuccess}</div>}

              <form onSubmit={handleAuthSubmit}>
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    className="form-input"
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Enter your username"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    className="form-input"
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  {authMode === 'login' ? 'Log In' : 'Create Account'}
                </button>
              </form>
            </div>
            <p className="text-secondary text-small" style={{ textAlign: 'center', marginTop: '12px' }}>
                User accounts are securely stored in the database.
            </p>
          </div>
        )}

        {/* ────────────────────────────────────────
            VIEW 2: DASHBOARD
        ──────────────────────────────────────── */}
        {currentPage === 'dashboard' && (
          <div>
            {/* Top action row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Dashboard</h1>
              <button
                className="btn btn-primary"
                onClick={() => setCurrentPage('analysis')}
              >
                New Analysis
              </button>
            </div>

            {/* History card */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                <span className="card-title" style={{ borderBottom: 'none', padding: 0, margin: 0, display: 'block' }}>
                  Past Analyses
                </span>
              </div>

              {history.length === 0 ? (
                <div className="empty-state">
                  No analyses yet. Click <strong>New Analysis</strong> to get started.
                </div>
              ) : (
                <div className="history-list">
                  {/* Header row */}
                  <div className="history-row" style={{ background: 'var(--bg-muted)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    <span>Question</span>
                    <span>Date</span>
                    <span>Recommended Option</span>
                    <span></span>
                  </div>
                  {history.map((item) => {
                    const rank1OptionObj = item.response.rankings.find(r => r.rank === 1);
                    const recommendation = rank1OptionObj ? rank1OptionObj.option : 'N/A';

                    return (
                      <div className="history-row" key={item.id}>
                        <span className="history-row-question">{item.question}</span>
                        <span className="history-row-date">{formatDate(item.timestamp)}</span>
                        <span className="history-row-rec" title={recommendation}>{recommendation}</span>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8125rem', padding: '4px 12px' }}
                          onClick={() => handleViewHistoryItem(item)}
                        >
                          View
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────
            VIEW 3: ANALYSIS PAGE
        ──────────────────────────────────────── */}
        {currentPage === 'analysis' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' }}>New Analysis</h1>

            <div className="card">
              {analysisError && <div className="callout callout-error">{analysisError}</div>}

              {isAnalyzing ? (
                <div className="loading-view">
                  <p>Consulting Decision Support System…</p>
                  <p className="text-secondary text-small">Analyzing your options. This may take a moment.</p>
                </div>
              ) : (
                <form onSubmit={handleAnalyze}>
                  {/* Decision question */}
                  <div className="form-group">
                    <label htmlFor="question-input">Decision Question</label>
                    <input
                      id="question-input"
                      className="form-input"
                      type="text"
                      required
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g., Which master's programme should I prioritize?"
                    />
                    <span className="helper-text">State your decision question clearly and concisely.</span>
                  </div>

                  {/* Options */}
                  <div className="form-group">
                    <label>Options <span className="text-secondary" style={{ fontWeight: 400 }}>(2 – 5)</span></label>

                    {options.map((option, idx) => (
                      <div key={idx} className="dynamic-option-row">
                        <input
                          aria-label={`Option ${idx + 1}`}
                          className="form-input"
                          type="text"
                          required
                          value={option}
                          onChange={(e) => handleOptionChange(e.target.value, idx)}
                          placeholder={`Option ${idx + 1}`}
                        />
                        {options.length > 2 && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '10px 14px', flexShrink: 0 }}
                            onClick={() => handleRemoveOption(idx)}
                            title="Remove option"
                            aria-label="Remove option"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}

                    {options.length < 5 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                        onClick={handleAddOption}
                      >
                        + Add Option
                      </button>
                    )}
                  </div>

                  <hr className="divider" />

                  <div className="btn-group" style={{ marginTop: '0' }}>
                    <button type="submit" className="btn btn-primary">Analyze Options</button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setCurrentPage('dashboard');
                        setAnalysisError('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────
            VIEW 4: RESULTS PAGE
        ──────────────────────────────────────── */}
        {currentPage === 'results' && activeAnalysis && (
          <div>
            <div className="card">

              {/* Results header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <p className="results-meta">Analysis Report · {formatDate(activeAnalysis.timestamp)}</p>
                  <h2 className="results-question">{activeAnalysis.question}</h2>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ flexShrink: 0, marginLeft: '16px' }}
                  onClick={() => setCurrentPage('dashboard')}
                >
                  Back to Dashboard
                </button>
              </div>

              {/* Final recommendation */}
              <div className="rec-banner">
                <div className="rec-banner-title">Final Recommendation</div>
                <p>{activeAnalysis.response.finalRecommendation}</p>
              </div>

              <hr className="divider" />

              {/* Ranked options */}
              <p className="section-label">Ranked Options</p>

              {activeAnalysis.response.rankings.map((item, idx) => (
                <div className="rank-card" key={idx}>
                  <div className="rank-card-header">
                    <span className="rank-card-title">{item.option}</span>
                    <span className={`rank-badge${item.rank === 1 ? ' rank-badge-first' : ''}`}>
                      #{item.rank}
                    </span>
                  </div>
                  <div className="rank-card-body">
                    <p style={{ fontSize: '0.9375rem', marginBottom: '0' }}>
                      {item.explanation}
                    </p>

                    <div className="pro-con-grid">
                      <div className="pro-box">
                        <h4>Pros</h4>
                        {item.pros && item.pros.length > 0 ? (
                          <ul className="pro-con-list">
                            {item.pros.map((pro, pIdx) => <li key={pIdx}>{pro}</li>)}
                          </ul>
                        ) : (
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                            No notable advantages.
                          </p>
                        )}
                      </div>

                      <div className="con-box">
                        <h4>Cons</h4>
                        {item.cons && item.cons.length > 0 ? (
                          <ul className="pro-con-list">
                            {item.cons.map((con, cIdx) => <li key={cIdx}>{con}</li>)}
                          </ul>
                        ) : (
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                            No notable drawbacks.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer>
        <p>© 2026 Student AI Decision Support System · Powered by Llama 3.1</p>
      </footer>
    </div>
  );
}
