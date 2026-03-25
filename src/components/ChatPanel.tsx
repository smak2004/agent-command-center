import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { Agent, ChatMessage } from '@/hooks/useAgents';

interface ChatPanelProps {
  agent: Agent;
  messages: ChatMessage[];
  sending: boolean;
  onSend: (message: string) => void;
  onClose: () => void;
}

export function ChatPanel({ agent, messages, sending, onSend, onClose }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [agent.id]);

  const handleSend = () => {
    if (!input.trim() || sending) return;
    onSend(input.trim());
    setInput('');
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-slide-in fixed right-0 top-0 bottom-0 w-full max-w-[400px] z-50 flex flex-col bg-popover/95 backdrop-blur-xl border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xl">
            {agent.emoji}
          </div>
          <div>
            <div className="font-semibold text-foreground text-sm">{agent.displayName}</div>
            <div className="text-xs text-muted-foreground">{agent.tag}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            <div className="text-3xl mb-2">{agent.emoji}</div>
            <p>Start a conversation with {agent.displayName}</p>
            <p className="text-xs mt-1 opacity-60">{agent.description}</p>
          </div>
        )}
        
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? '' : 'flex gap-2'}`}>
              {msg.role === 'agent' && (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs flex-shrink-0 mt-1">
                  {agent.emoji}
                </div>
              )}
              <div>
                <div className={`
                  rounded-2xl px-3 py-2 text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-chat-user text-primary-foreground rounded-br-md'
                    : 'bg-chat-agent text-foreground rounded-bl-md'
                  }
                `}>
                  {msg.content}
                </div>
                <div className={`text-[10px] text-muted-foreground mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs flex-shrink-0">
                {agent.emoji}
              </div>
              <div className="bg-chat-agent rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse-dot"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={`Message ${agent.displayName}...`}
            className="flex-1 bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-30 transition-all"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
