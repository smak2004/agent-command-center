import { useState, useEffect, useCallback, useRef } from 'react';

const LS_KEY = 'jarvis-hq-backend-url';
const NGROK_HEADERS = { 'ngrok-skip-browser-warning': '1' };

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

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch(`${getBackendUrl()}/agents`, { headers: NGROK_HEADERS })
      .then(r => r.json())
      .then(data => {
        setAgents(data.agents || []);
        setConnected(true);
        setLoading(false);
      })
      .catch(() => {
        setConnected(false);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const poll = () => {
      fetch(`${getBackendUrl()}/agents/status`, { headers: NGROK_HEADERS })
        .then(r => r.json())
        .then(data => {
          setStatuses(data.status || {});
          setConnected(true);
        })
        .catch(() => {
          setConnected(false);
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
      const res = await fetch(`${getBackendUrl()}/message`, {
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
