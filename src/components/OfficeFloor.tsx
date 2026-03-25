import { useState } from 'react';
import { Agent, useAgents, useChat, getBackendUrl, setBackendUrl } from '@/hooks/useAgents';
import { AgentDesk } from './AgentDesk';
import { ChatPanel } from './ChatPanel';
import { Settings, Check } from 'lucide-react';

export function OfficeFloor() {
  const { agents, statuses, loading, connected } = useAgents();
  const { sendMessage, getMessages, sending } = useChat();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState(getBackendUrl());

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl">🤖</div>
          <div className="text-muted-foreground text-sm">Initializing Jarvis HQ...</div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const mainAgent = agents.find(a => a.isDefault || a.id === 'jarvis');
  const otherAgents = agents.filter(a => a !== mainAgent);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
  };

  const handleSend = (message: string) => {
    if (selectedAgent) {
      sendMessage(message, selectedAgent.id);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--amber-glow)/0.03),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--monitor-glow)/0.02),transparent_60%)]" />
      
      {/* Grid lines on floor */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div className={`relative z-10 transition-all duration-300 ${selectedAgent ? 'mr-[400px]' : ''}`}>
        {/* Header */}
        <header className="pt-8 pb-6 px-6">
          <div className="flex items-center justify-between">
            <div className="w-10" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                <span className="text-primary">⬡</span> Jarvis HQ
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Command Center</p>
            </div>
            <button
              onClick={() => setShowSettings(s => !s)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Settings size={18} />
            </button>
          </div>

          {/* Settings dropdown */}
          {showSettings && (
            <div className="max-w-md mx-auto mt-4 bg-card border border-border rounded-xl p-4 animate-fade-in">
              <label className="text-xs text-muted-foreground mb-2 block">Backend URL</label>
              <div className="flex gap-2">
                <input
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setBackendUrl(urlInput)}
                  placeholder="https://your-ngrok-url.ngrok.io"
                  className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button
                  onClick={() => setBackendUrl(urlInput)}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                >
                  <Check size={14} /> Save
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Saved to localStorage. Clear the field and save to reset to default.
              </p>
            </div>
          )}

          {/* Connection + status bar */}
          <div className="flex items-center justify-center gap-4 mt-4">
            {!connected && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-400/10 px-2.5 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Demo Mode
              </div>
            )}
            {connected && (
              <div className="flex items-center gap-1.5 text-xs text-green-400/80">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Live
              </div>
            )}
            <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
              {getBackendUrl()}
            </div>
            <StatusPill label="Active" count={Object.values(statuses).filter(s => s !== 'idle').length} active />
            <StatusPill label="Total" count={agents.length} />
          </div>
        </header>

        {/* Main agent - Jarvis */}
        {mainAgent && (
          <div className="max-w-xs mx-auto px-6 mb-6">
            <AgentDesk
              agent={mainAgent}
              status={statuses[mainAgent.id] || 'idle'}
              isMain
              onClick={() => handleSelectAgent(mainAgent)}
            />
          </div>
        )}

        {/* Pipeline agents grid */}
        <div className="max-w-3xl mx-auto px-6 pb-12">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 px-1">
            Pipeline Agents
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {otherAgents.map(agent => (
              <AgentDesk
                key={agent.id}
                agent={agent}
                status={statuses[agent.id] || 'idle'}
                onClick={() => handleSelectAgent(agent)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      {selectedAgent && (
        <ChatPanel
          agent={selectedAgent}
          messages={getMessages(selectedAgent.id)}
          sending={sending}
          onSend={handleSend}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}

function StatusPill({ label, count, active }: { label: string; count: number; active?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-primary shadow-[0_0_4px_rgba(245,158,11,0.6)]' : 'bg-muted-foreground/30'}`} />
      <span>{count} {label}</span>
    </div>
  );
}
