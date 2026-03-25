import { useState, useEffect, useCallback, useRef } from 'react';

const LS_KEY = 'jarvis-hq-backend-url';

export function getBackendUrl(): string {
  return localStorage.getItem(LS_KEY)
    || import.meta.env.VITE_BACKEND_URL
    || 'http://localhost:3001';
}

export function setBackendUrl(url: string) {
  if (url.trim()) {
    localStorage.setItem(LS_KEY, url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem(LS_KEY);
  }
  // Trigger re-fetch by reloading
  window.location.reload();
}

export interface Agent {
  id: string;
  displayName: string;
  description: string;
  emoji: string;
  tag: string;
  isDefault: boolean;
}

export type AgentStatus = 'idle' | 'working' | 'reading' | 'handoff';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  agentId: string;
}

const MOCK_AGENTS: Agent[] = [
  { id: 'jarvis', displayName: 'Jarvis', description: 'Central orchestrator and command hub', emoji: '🤖', tag: 'Orchestrator', isDefault: true },
  { id: 'research', displayName: 'Research', description: 'Deep research and analysis', emoji: '🔍', tag: 'PHO Pipeline', isDefault: false },
  { id: 'concept', displayName: 'Concept', description: 'Ideation and concept development', emoji: '💡', tag: 'PHO Pipeline', isDefault: false },
  { id: 'script', displayName: 'Script', description: 'Script and copy writing', emoji: '✍️', tag: 'PHO Pipeline', isDefault: false },
  { id: 'brand', displayName: 'Brand', description: 'Brand strategy and identity', emoji: '🎨', tag: 'PHO Pipeline', isDefault: false },
  { id: 'creative', displayName: 'Creative', description: 'Visual and creative production', emoji: '🖼️', tag: 'PHO Pipeline', isDefault: false },
  { id: 'distribution', displayName: 'Distribution', description: 'Channel distribution strategy', emoji: '📡', tag: 'PHO Pipeline', isDefault: false },
  { id: 'growth', displayName: 'Growth', description: 'Growth and performance optimization', emoji: '📈', tag: 'PHO Pipeline', isDefault: false },
];

// Cycle through demo statuses when backend is offline
const DEMO_STATUSES: AgentStatus[] = ['idle', 'working', 'reading', 'idle', 'idle', 'working', 'idle', 'handoff'];

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const demoTick = useRef(0);

  useEffect(() => {
    fetch(`${getBackendUrl()}/agents`)
      .then(r => r.json())
      .then(data => {
        setAgents(data.agents || []);
        setConnected(true);
        setLoading(false);
      })
      .catch(() => {
        // Fallback to mock data
        setAgents(MOCK_AGENTS);
        setConnected(false);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const poll = () => {
      fetch(`${getBackendUrl()}/agents/status`)
        .then(r => r.json())
        .then(data => {
          setStatuses(data.status || {});
          setConnected(true);
        })
        .catch(() => {
          // Demo: rotate statuses so the office feels alive
          if (!connected && agents.length > 0) {
            demoTick.current++;
            const demoStatuses: Record<string, AgentStatus> = {};
            agents.forEach((a, i) => {
              const idx = (demoTick.current + i * 3) % DEMO_STATUSES.length;
              demoStatuses[a.id] = DEMO_STATUSES[idx];
            });
            setStatuses(demoStatuses);
          }
        });
    };
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [agents, connected]);

  return { agents, statuses, loading, connected };
}

export function useChat() {
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [sending, setSending] = useState(false);
  const idCounter = useRef(0);

  const sendMessage = useCallback(async (message: string, agentId: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${++idCounter.current}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      agentId,
    };
    
    setMessages(prev => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), userMsg],
    }));
    
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, agentId }),
      });
      const data = await res.json();
      
      const agentMsg: ChatMessage = {
        id: `msg-${++idCounter.current}`,
        role: 'agent',
        content: data.response,
        timestamp: new Date(),
        agentId: data.agentId || agentId,
      };
      
      setMessages(prev => ({
        ...prev,
        [agentId]: [...(prev[agentId] || []), agentMsg],
      }));
    } catch {
      const errMsg: ChatMessage = {
        id: `msg-${++idCounter.current}`,
        role: 'agent',
        content: 'Connection error. Please try again.',
        timestamp: new Date(),
        agentId,
      };
      setMessages(prev => ({
        ...prev,
        [agentId]: [...(prev[agentId] || []), errMsg],
      }));
    } finally {
      setSending(false);
    }
  }, []);

  const getMessages = useCallback((agentId: string) => {
    return messages[agentId] || [];
  }, [messages]);

  return { sendMessage, getMessages, sending };
}
