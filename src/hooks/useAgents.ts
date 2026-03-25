import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'http://localhost:3001';

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

  useEffect(() => {
    fetch(`${API_BASE}/agents`)
      .then(r => r.json())
      .then(data => {
        setAgents(data.agents || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const poll = () => {
      fetch(`${API_BASE}/agents/status`)
        .then(r => r.json())
        .then(data => setStatuses(data.status || {}))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, []);

  return { agents, statuses, loading };
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
