import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import './home.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const API_AUTH_KEY = process.env.REACT_APP_AUTH_KEY || "";

function VynadamPage() {
  const MAX_CONTEXT_MESSAGES = 16;
  const MAX_CONTEXT_CHARS = 14000;
  const MAX_MESSAGE_CHARS = 2400;

  const [inputValue, setInputValue] = useState('');
  const [activeNav, setActiveNav] = useState('Chat');
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  //adding new state for projects
  const [projects, setProjects] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Dashboard & User states
  const [user, setUser] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Github States
  const [isGithubConnected, setIsGithubConnected] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const navigate = useNavigate();

  // Chat actions
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("vynedam_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const buildAuthHeaders = () => {
    const token = localStorage.getItem("vynedam_token");
    if (!token) return null;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    if (API_AUTH_KEY) {
      headers['x-auth-key'] = API_AUTH_KEY;
    }

    return headers;
  };

  const mapApiChatToProject = (chat) => ({
    id: String(chat.id),
    name: chat.name || 'New Chat',
    messages: Array.isArray(chat.messages) ? chat.messages.map((m) => ({
      id: String(m.id),
      sender: m.sender,
      text: m.text,
      previewUrl: m.previewUrl || null,
      downloadUrl: m.downloadUrl || null,
    })) : null,
    hasLoadedMessages: Array.isArray(chat.messages),
    isPinned: false,
  });

  const handleOpenChat = async (chatId) => {
    setActiveChatId(chatId);

    const selected = projects.find((p) => p.id === chatId);
    if (selected?.hasLoadedMessages) return;

    const headers = buildAuthHeaders();
    if (!headers) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, { headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.chat) {
        throw new Error(payload?.error || 'Failed to open chat');
      }

      const fullChat = mapApiChatToProject(payload.chat);
      setProjects((prev) => prev.map((p) => (p.id === chatId ? { ...p, ...fullChat } : p)));
    } catch (err) {
      console.error('Open chat failed:', err.message);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("vynedam_token");
    if (!user || !token) {
      setProjects([]);
      setActiveChatId(null);
      return;
    }

    const headers = buildAuthHeaders();
    if (!headers) return;

    fetch(`${API_BASE_URL}/api/chats`, { headers })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Failed to load chats');

        const loaded = (payload?.chats || []).map(mapApiChatToProject);
        setProjects(loaded);
        setActiveChatId((prev) => (prev && loaded.some((c) => c.id === prev) ? prev : (loaded[0]?.id || null)));
      })
      .catch((err) => {
        console.error('Load chats failed:', err.message);
      });
  }, [user]);

  const trimForContext = (value, maxChars = MAX_MESSAGE_CHARS) => {
    const clean = String(value || '').trim();
    if (!clean) return '';
    if (clean.length <= maxChars) return clean;
    return `${clean.slice(0, maxChars)}\n\n[truncated for context]`;
  };

  const buildConversationForApi = (priorMessages, latestUserPrompt) => {
    const mapped = (priorMessages || [])
      .map((m) => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: trimForContext(m.text),
      }))
      .filter((m) => m.content)
      .filter((m) => {
        const c = m.content.toLowerCase();
        return !(
          c.includes('unable to process request right now') ||
          c.includes('api auth key is missing or invalid') ||
          c === 'unauthorized'
        );
      });

    const withLatest = [...mapped, { role: 'user', content: trimForContext(latestUserPrompt, 1000) }].slice(-MAX_CONTEXT_MESSAGES);

    // Keep recent turns while respecting a rough character budget.
    const reversed = [];
    let used = 0;
    for (let i = withLatest.length - 1; i >= 0; i -= 1) {
      const item = withLatest[i];
      const size = item.content.length;
      if (used + size > MAX_CONTEXT_CHARS) continue;
      reversed.push(item);
      used += size;
    }

    return reversed.reverse();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [projects]);

  useEffect(() => {
    if (activeNav !== 'Chat' || isLoading) return;
    const timer = setTimeout(() => {
      chatInputRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [activeNav, isLoading, activeChatId, projects.length]);

  const handleLogout = () => {
    localStorage.removeItem("vynedam_user");
    setUser(null);
    setShowProfileMenu(false);
  };

  const handleNewProject = async () => {
    const headers = buildAuthHeaders();
    if (!headers || !user) {
      setShowAuthPrompt(true);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/chats`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'New Chat' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to create chat');

      const created = mapApiChatToProject(payload.chat);
      setProjects((prev) => [created, ...prev]);
      setActiveChatId(created.id);
      setActiveNav('Chat');
    } catch (err) {
      console.error('Create chat failed:', err.message);
    }
  };

  const handleDeleteChat = async (id, e) => {
    e.stopPropagation();
    const headers = buildAuthHeaders();
    if (headers) {
      try {
        await fetch(`${API_BASE_URL}/api/chats/${id}`, {
          method: 'DELETE',
          headers,
        });
      } catch (err) {
        console.error('Delete chat failed:', err.message);
      }
    }

    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeChatId === id) setActiveChatId(null);
    setOpenMenuId(null);
  };

  const handlePinChat = (id, e) => {
    e.stopPropagation();
    setProjects(prevProjects => {
      const chat = prevProjects.find(p => p.id === id);
      const others = prevProjects.filter(p => p.id !== id);
      return [{ ...chat, isPinned: !chat.isPinned }, ...others].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    });
    setOpenMenuId(null);
  };

  const startRename = (id, currentName, e) => {
    e.stopPropagation();
    setEditingChatId(id);
    setEditingName(currentName);
    setOpenMenuId(null);
  };

  const saveRename = async (id, e) => {
    if (e && e.key && e.key !== 'Enter') return;
    if (e) e.stopPropagation();
    const nextName = editingName.trim();
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: nextName || p.name } : p)));

    const headers = buildAuthHeaders();
    if (headers && nextName) {
      try {
        await fetch(`${API_BASE_URL}/api/chats/${id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ name: nextName }),
        });
      } catch (err) {
        console.error('Rename chat failed:', err.message);
      }
    }

    setEditingChatId(null);
  };

  // Handle navigation clicks
  const handleNavClick = (navName) => {
    setActiveNav(navName);
  };

  // Handle Attach button
  const handleAttach = () => {
    // Create a hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*,.pdf,.txt,.doc,.docx';

    fileInput.onchange = (e) => {
      const files = Array.from(e.target.files);
      setAttachedFiles(prev => [...prev, ...files]);
    };

    fileInput.click();
  };

  // Handle Settings button
  const handleSettings = () => {
    setShowSettings(!showSettings);
  };

  // Handle Send message
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    setActiveNav('Chat');
    const headers = buildAuthHeaders();
    if (!headers || !user) {
      setShowAuthPrompt(true);
      return;
    }

    const messageText = inputValue.trim();
    let currentActiveId = activeChatId;
    let currentProjects = [...projects];

    try {
      if (!currentActiveId) {
        const newName = messageText.length > 25 ? messageText.substring(0, 25) + "..." : messageText;
        const createRes = await fetch(`${API_BASE_URL}/api/chats`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: newName }),
        });
        const createPayload = await createRes.json().catch(() => ({}));
        if (!createRes.ok) throw new Error(createPayload?.error || 'Failed to create chat');

        const created = mapApiChatToProject(createPayload.chat);
        currentProjects = [created, ...currentProjects];
        currentActiveId = created.id;
        setProjects(currentProjects);
        setActiveChatId(created.id);
      } else {
        currentProjects = currentProjects.map((p) => {
          if (p.id === currentActiveId && p.name === 'New Chat') {
            const newName = messageText.length > 25 ? messageText.substring(0, 25) + "..." : messageText;
            fetch(`${API_BASE_URL}/api/chats/${currentActiveId}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ name: newName }),
            }).catch(() => {});
            return { ...p, name: newName };
          }
          return p;
        });
      }

      const activeProjectBeforeSend = currentProjects.find((p) => p.id === currentActiveId);
      const priorMessages = activeProjectBeforeSend?.messages || [];
      const conversationForApi = buildConversationForApi(priorMessages, messageText);

      const localUserMessage = { id: String(Date.now()), text: messageText, sender: 'user' };
      setProjects((prev) => prev.map((p) => {
        if (p.id === currentActiveId) {
          return { ...p, messages: [...(p.messages || []), localUserMessage] };
        }
        return p;
      }));

      setInputValue('');
      setIsLoading(true);

      fetch(`${API_BASE_URL}/api/chats/${currentActiveId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sender: 'user', text: messageText }),
      }).catch((err) => console.error('Persist user message failed:', err.message));

      const res = await fetch(`${API_BASE_URL}/api/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: messageText, messages: conversationForApi }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        const errorText = String(data?.error || '').toLowerCase();
        const isAuthKeyError = /(auth[\s_-]*key|x-auth-key|api key)/i.test(errorText);
        if (isAuthKeyError) {
          throw new Error('API auth key is missing or invalid in frontend config.');
        }
        localStorage.removeItem("vynedam_user");
        localStorage.removeItem("vynedam_token");
        setUser(null);
        setShowAuthPrompt(true);
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error(data?.error || data?.message || 'API Error');

      const resultText = String(data.result || "");
      const isProjectLike = /(project\s*name|file\s*tree|run\s*steps|```)/i.test(resultText);
      const aiMsg = {
        id: String(Date.now() + 1),
        text: resultText || "Request processed.",
        code: null,
        previewUrl: data.previewUrl || null,
        downloadUrl: data.downloadUrl || null,
        showArtifacts: isProjectLike,
        sender: 'ai'
      };

      setProjects((prev) => prev.map((p) => {
        if (p.id === currentActiveId) {
          return { ...p, messages: [...(p.messages || []), aiMsg] };
        }
        return p;
      }));

      fetch(`${API_BASE_URL}/api/chats/${currentActiveId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sender: 'ai',
          text: aiMsg.text,
          previewUrl: aiMsg.previewUrl,
          downloadUrl: aiMsg.downloadUrl,
        }),
      }).catch((err) => console.error('Persist AI message failed:', err.message));
    } catch (err) {
      const friendlyError = String(err?.message || 'Unable to process request right now. Please try again.');
      setProjects((prev) => prev.map((p) => {
        if (p.id === currentActiveId) {
          const aiMsg = {
            id: String(Date.now() + 1),
            text: friendlyError,
            code: null,
            sender: 'ai'
          };
          return { ...p, messages: [...(p.messages || []), aiMsg] };
        }
        return p;
      }));
    } finally {
      setIsLoading(false);
      setActiveNav('Chat');
    }
  };

  const handlePublishToGithub = () => {
    setShowGithubModal(true);
  };

  const simulateGithubConnect = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsGithubConnected(true);
      setIsPublishing(false);
    }, 1500);
  };

  const simulatePublishPush = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      setPublishSuccess(true);
      setTimeout(() => {
        setPublishSuccess(false);
        setShowGithubModal(false);
      }, 2000);
    }, 2500);
  };

  const handleDisconnectGithub = () => {
    setIsGithubConnected(false);
  };

  const GithubPublishModal = () => (
    <div className="github-modal-overlay" onClick={() => setShowGithubModal(false)}>
      <div className="github-modal-content" onClick={e => e.stopPropagation()}>
        <div className="github-modal-header">
          <div className="github-header-title">
            {Icons.Github}
            <h4>Publish to GitHub</h4>
          </div>
          <button className="close-modal" onClick={() => setShowGithubModal(false)}>×</button>
        </div>

        {!isGithubConnected ? (
          <div className="github-connect-view">
            <div className="github-promo-icon">{Icons.Github}</div>
            <h5>Connect your GitHub account</h5>
            <p>Publish your generated code directly to your GitHub repositories with one click.</p>
            <button 
              className="github-primary-btn" 
              onClick={simulateGithubConnect}
              disabled={isPublishing}
            >
              {isPublishing ? "Connecting..." : "Connect GitHub Account"}
            </button>
          </div>
        ) : (
          <div className="github-publish-view">
            {publishSuccess ? (
              <div className="publish-success-view">
                <div className="success-check">✓</div>
                <h5>Successfully Published!</h5>
                <p>Your code has been pushed to <strong>vynedam-ai-app</strong></p>
                <button className="github-secondary-btn" onClick={() => setShowGithubModal(false)}>Close</button>
              </div>
            ) : (
              <>
                <div className="github-user-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <img src={`https://github.com/${user?.username || 'user'}.png`} alt="Github" className="github-user-avatar" onError={(e) => e.target.src = 'https://github.com/github.png'} />
                    <div>
                      <span className="github-username">@{user?.username?.toLowerCase() || 'dev_user'}</span>
                      <span className="github-status">Connected</span>
                    </div>
                  </div>
                  <button className="github-disconnect-btn" onClick={handleDisconnectGithub} title="Disconnect Github">
                    Sign Out
                  </button>
                </div>

                <div className="repo-selection">
                  <label>Select Repository</label>
                  <div className="repo-list">
                    <div className="repo-item active">
                      <span className="repo-icon">📁</span>
                      <div className="repo-details">
                        <span className="repo-name">vynedam-ai-app</span>
                        <span className="repo-meta">Private • Updated 2m ago</span>
                      </div>
                      <span className="repo-check">✓</span>
                    </div>
                    <div className="repo-item">
                      <span className="repo-icon">📁</span>
                      <div className="repo-details">
                        <span className="repo-name">portfolio-v3</span>
                        <span className="repo-meta">Public • Updated 1d ago</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="publish-actions">
                  <button 
                    className="github-primary-btn" 
                    onClick={simulatePublishPush}
                    disabled={isPublishing}
                  >
                    {isPublishing ? "Publishing..." : "Push to GitHub"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // SVG Icons Setup
  const Icons = {
    Chat: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
    Archive: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>,
    Library: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>,
    Plus: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
    History: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
    MessageSquare: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
    Reset: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>,
    Attach: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
    Settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
    More: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>,
    Send: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
    Copy: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
    Edit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
    Trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
    Pin: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.8l-1.78.89A2 2 0 0 0 5 15.24Z"></path></svg>,
    Play: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>,
    Github: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
  };

  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (text, id) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(err => console.error("Clipboard copy failed", err));
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.prepend(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (error) {
        console.error("Fallback clipboard copy failed", error);
      } finally {
        textArea.remove();
      }
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderAiContent = (msg) => {
    const text = String(msg?.text || "");
    const fenceRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
    const blocks = [];
    let lastIndex = 0;
    let match;

    while ((match = fenceRegex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before.trim()) {
        blocks.push({ type: "text", content: before });
      }

      blocks.push({
        type: "code",
        lang: match[1] || "",
        content: match[2] || "",
      });

      lastIndex = fenceRegex.lastIndex;
    }

    const trailing = text.slice(lastIndex);
    if (trailing.trim()) {
      blocks.push({ type: "text", content: trailing });
    }

    const renderTextBlock = (raw, keyPrefix) => {
      const normalized = String(raw || "")
        .replace(/\r\n/g, "\n")
        .replace(/\s(#{1,6}\s)/g, "\n$1")
        .replace(/\s(\d+\.\s)/g, "\n$1")
        .replace(/\s([-*]\s)/g, "\n$1")
        .trim();

      const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
      if (!lines.length) {
        return <p className="ai-md-paragraph" key={`${keyPrefix}-empty`}></p>;
      }

      const items = [];
      let listMode = null;
      let listBuffer = [];

      const flushList = () => {
        if (!listMode || !listBuffer.length) return;
        if (listMode === "ol") {
          items.push(
            <ol className="ai-md-list ai-md-ordered" key={`${keyPrefix}-ol-${items.length}`}>
              {listBuffer.map((it, i) => <li key={`${keyPrefix}-oli-${i}`}>{it}</li>)}
            </ol>
          );
        } else {
          items.push(
            <ul className="ai-md-list ai-md-unordered" key={`${keyPrefix}-ul-${items.length}`}>
              {listBuffer.map((it, i) => <li key={`${keyPrefix}-uli-${i}`}>{it}</li>)}
            </ul>
          );
        }
        listMode = null;
        listBuffer = [];
      };

      lines.forEach((line) => {
        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
          flushList();
          items.push(
            <div className={`ai-md-heading ai-md-h${heading[1].length}`} key={`${keyPrefix}-h-${items.length}`}>
              {heading[2]}
            </div>
          );
          return;
        }

        const ordered = line.match(/^\d+\.\s+(.+)$/);
        if (ordered) {
          if (listMode !== "ol") {
            flushList();
            listMode = "ol";
          }
          listBuffer.push(ordered[1]);
          return;
        }

        const unordered = line.match(/^[-*]\s+(.+)$/);
        if (unordered) {
          if (listMode !== "ul") {
            flushList();
            listMode = "ul";
          }
          listBuffer.push(unordered[1]);
          return;
        }

        flushList();
        items.push(
          <p className="ai-md-paragraph" key={`${keyPrefix}-p-${items.length}`}>
            {line.replace(/^`|`$/g, "")}
          </p>
        );
      });

      flushList();
      return <div className="ai-text-block" key={`${keyPrefix}-text-block`}>{items}</div>;
    };

    if (!blocks.length) {
      return renderTextBlock(text, `${msg.id}-single`);
    }

    return blocks.map((block, index) => {
      if (block.type === "code") {
        return (
          <div className="message-part-code" key={`${msg.id}-code-${index}`}>
            <button
              className="copy-code-btn"
              onClick={() => handleCopy(block.content, `${msg.id}-code-${index}`)}
            >
              {copiedId === `${msg.id}-code-${index}` ? "Copied!" : "Copy"}
            </button>
            <pre className="ai-code-text"><code>{block.content}</code></pre>
          </div>
        );
      }

      return renderTextBlock(block.content, `${msg.id}-text-${index}`);
    });
  };

  const AuthRequiredModal = () => (
    <div className="auth-required-overlay" onClick={() => setShowAuthPrompt(false)}>
      <div className="auth-required-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-required-icon">🔒</div>
        <h3>Sign In Required</h3>
        <p>You need to log in before sending messages.</p>
        <div className="auth-required-actions">
          <button className="auth-required-secondary" onClick={() => setShowAuthPrompt(false)}>
            Not now
          </button>
          <button
            className="auth-required-primary"
            onClick={() => {
              setShowAuthPrompt(false);
              navigate('/login');
            }}
          >
            Login
          </button>
          <button
            className="auth-required-primary alt"
            onClick={() => {
              setShowAuthPrompt(false);
              navigate('/signup');
            }}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );

  const activeChat = projects.find(p => p.id === activeChatId);
  const displayName = user?.name || user?.username || user?.email || 'User';

  return (
    <div className={`VynedamApp theme-${theme}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
        {isSidebarOpen ? (
          <>
            <div className="logo" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="logo-icon">✦</span>
                <span className="logo-text">Vynedam AI</span>
              </div>
              <button 
                className="toggle-sidebar-btn" 
                onClick={() => setIsSidebarOpen(false)} 
                title="Close sidebar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
              </button>
            </div>

            <nav className="nav-primary">
              <button
                type="button"
                className={`nav-item ${activeNav === 'Chat' ? 'active' : ''}`}
                onClick={() => handleNavClick('Chat')}
              >
                <span className="nav-icon">{Icons.Chat}</span> <span>Chat</span>
              </button>

            </nav>

            <div className="workspaces-section">
              <h3 className="section-title">Workspaces</h3>
              <button className="workspace-btn new-project" onClick={handleNewProject}>
                <span className="plus-icon">{Icons.Plus}</span> <span>New Chat</span>
              </button>
              <div className="workspace-items">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`project-item ${activeChatId === project.id ? 'active' : ''}`}
                    onClick={() => handleOpenChat(project.id)}
                    style={{
                      background: activeChatId === project.id ? 'var(--glass-bg)' : 'transparent',
                      border: activeChatId === project.id ? '1px solid var(--glass-border)' : '1px solid transparent',
                      color: activeChatId === project.id ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                  >
                    <div className="project-item-content">
                      <span className="project-icon">{project.isPinned ? Icons.Pin : Icons.MessageSquare}</span>
                      {editingChatId === project.id ? (
                        <input
                          type="text"
                          className="chat-rename-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => saveRename(project.id, e)}
                          onBlur={() => saveRename(project.id)}
                          autoFocus
                        />
                      ) : (
                        <span className="project-name">{project.name}</span>
                      )}
                    </div>

                    <div className="project-options-container">
                      <button
                        className="project-more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === project.id ? null : project.id);
                        }}
                      >
                        {Icons.More}
                      </button>

                      {openMenuId === project.id && (
                        <div className="chat-options-menu">
                          <button onClick={(e) => startRename(project.id, project.name, e)}>
                            {Icons.Edit} Rename
                          </button>
                          <button onClick={(e) => handlePinChat(project.id, e)}>
                            {Icons.Pin} {project.isPinned ? "Unpin chat" : "Pin chat"}
                          </button>
                          <button className="delete-chat" onClick={(e) => handleDeleteChat(project.id, e)}>
                            {Icons.Trash} Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="collapsed-nav-items">
            <div className="collapsed-logo" onClick={() => setIsSidebarOpen(true)} title="Open Sidebar">
              <span className="logo-icon">✦</span>
            </div>
            
            <button className="collapsed-icon-btn" onClick={() => { setIsSidebarOpen(true); handleNewProject(); }} title="New chat">
              {Icons.Edit} 
            </button>

            <div className="collapsed-nav-bottom">
               <button className="collapsed-icon-btn" onClick={() => setIsSidebarOpen(true)} title="Open sidebar">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
               </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="top-right-auth">
          {user && (
            <button className="publish-github-btn" onClick={handlePublishToGithub}>
              {Icons.Github}
              <span>Publish</span>
            </button>
          )}
          {user ? (
            <div className="user-profile-container">
              <button
                className="user-profile-btn"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <div className="user-avatar">{displayName.charAt(0).toUpperCase()}</div>
                <span className="user-name-display">{displayName}</span>
              </button>

              {showProfileMenu && (
                <div className="profile-dropdown">
                  <div className="profile-header">
                    <h4>{displayName}</h4>
                    <p>{user.email}</p>
                  </div>
                  <div className="profile-actions">
                    <button onClick={handleLogout} className="logout-btn">Log Out</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <button className="login-btn" onClick={() => navigate("/login")}>Login</button>
              <button className="signup-btn" onClick={() => navigate("/signup")}>Sign Up</button>
            </>
          )}
        </div>

        {/* Main Content Area */}
        {activeChat && activeChat.messages && activeChat.messages.length > 0 ? (
          <div className="chat-history-container">
            {activeChat.messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble-row ${msg.sender}`}>
                {msg.sender === 'ai' && (
                  <div className="ai-avatar">✦</div>
                )}
                <div className={`chat-bubble-wrapper ${msg.sender}`}>
                  <div className={`chat-bubble ${msg.sender}`}>
                    {msg.sender === 'ai' ? (
                      <>
                        {renderAiContent(msg)}
                        {(() => {
                          const text = String(msg.text || '');
                          const hasProjectShape = /(project\s*name|file\s*tree|run\s*steps|```)/i.test(text);
                          return hasProjectShape && msg.previewUrl;
                        })() && (
                          <div className="message-extra-actions">
                            <a className="btn-preview" href={msg.previewUrl} target="_blank" rel="noreferrer">Open Live Preview</a>
                            {msg.downloadUrl && (
                              <a className="btn-preview" href={msg.downloadUrl} target="_blank" rel="noreferrer">Download ZIP</a>
                            )}
                          </div>
                        )}

                      </>
                    ) : (
                      msg.text
                    )}
                  </div>
                  <div className={`message-actions ${msg.sender}`}>
                    <button className="msg-action-btn" onClick={() => handleCopy(msg.text, msg.id + '-msg')} title="Copy">
                      {copiedId === msg.id + '-msg' ? <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Copied!</span> : Icons.Copy}
                    </button>
                    {msg.sender === 'user' && (
                      <button className="msg-action-btn" onClick={() => setInputValue(msg.text)} title="Edit">{Icons.Edit}</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="assistant-container">
            <div className="assistant-orb">
              <div className="orb-ring ring-1"></div>
              <div className="orb-ring ring-2"></div>
              <div className="orb-ring ring-3"></div>
              <div className="orb-core"></div>
            </div>
          </div>
        )}

        <div className="bottom-section">
          {/* Attached Files Display */}
          {attachedFiles.length > 0 && (
            <div className="attached-files">
              <strong>Attached Files</strong>
              <ul>
                {attachedFiles.map((file, index) => (
                  <li key={index}>
                    <span>📄 {file.name}</span>
                    <button
                      className="remove-file"
                      onClick={() => setAttachedFiles(attachedFiles.filter((_, i) => i !== index))}
                    >
                      ✖
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isLoading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Thinking...</span>
            </div>
          )}

          <div className="input-area">
            <div className="input-row">
              <input
                ref={chatInputRef}
                type="text"
                className="ask-input"
                placeholder={isLoading ? "Thinking..." : "Ask Anything..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
              />
              <button className="send-btn-inline" onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading}>
                {Icons.Send}
              </button>
            </div>
            <div className="input-actions">
              <button className="icon-btn" onClick={handleAttach}><span>{Icons.Attach}</span> Attach</button>
              <button className="icon-btn" onClick={handleSettings}><span>{Icons.Settings}</span> Settings</button>
            </div>
          </div>

          {showSettings && (
            <div className="panels-container">
              <div className="settings-panel">
                <h4>Settings</h4>
                <div className="setting-item">
                  <label>Theme</label>
                  <div className="theme-toggle">
                    <button
                      className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                      onClick={() => setTheme('dark')}
                    >
                      🌙 Dark
                    </button>
                    <button
                      className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                      onClick={() => setTheme('light')}
                    >
                      ☀️ Light
                    </button>
                  </div>
                </div>


              </div>
            </div>
          )}
        </div>
      </main>

      {/* Github Publish Modal */}
      {showGithubModal && <GithubPublishModal />}
      {showAuthPrompt && <AuthRequiredModal />}
    </div>
  );
}

export default VynadamPage;