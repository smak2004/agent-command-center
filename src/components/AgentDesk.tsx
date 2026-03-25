import { Agent, AgentStatus } from '@/hooks/useAgents';

interface AgentDeskProps {
  agent: Agent;
  status: AgentStatus;
  isMain?: boolean;
  onClick: () => void;
}

export function AgentDesk({ agent, status, isMain, onClick }: AgentDeskProps) {
  const isWorking = status === 'working';
  const isReading = status === 'reading';
  const isHandoff = status === 'handoff';
  const isActive = isWorking || isReading || isHandoff;

  const deskW = isMain ? 120 : 90;
  const deskH = isMain ? 70 : 50;

  return (
    <button
      onClick={onClick}
      className="relative group cursor-pointer focus:outline-none"
      style={{ width: deskW + 40, height: deskH + 80 }}
    >
      {/* Lamp light cone on desk surface */}
      <div
        className={`lamp-cone absolute ${isActive ? 'active' : ''}`}
        style={{
          width: deskW * 0.7,
          height: deskH * 0.6,
          top: 20,
          left: 8,
          borderRadius: '50%',
          opacity: isActive ? 1 : 0.3,
          pointerEvents: 'none',
        }}
      />

      {/* 3D Desk */}
      <div className="desk-3d absolute" style={{ bottom: 24, left: 20, width: deskW, height: deskH }}>
        {/* Desk top face */}
        <div className="desk-top absolute inset-0 rounded-sm" />
        {/* Desk front face */}
        <div className="desk-front rounded-b-sm" />
        {/* Desk side face */}
        <div className="desk-side rounded-r-sm" />
      </div>

      {/* Monitor */}
      <div
        className="absolute"
        style={{
          bottom: deskH + 26,
          left: 20 + deskW * 0.3,
          width: deskW * 0.4,
        }}
      >
        {/* Monitor stand */}
        <div
          className="monitor-stand mx-auto"
          style={{ width: 3, height: 6, marginBottom: -1 }}
        />
        {/* Monitor screen */}
        <div
          className={`monitor-screen relative overflow-hidden rounded-sm ${isActive ? 'active' : ''}`}
          style={{
            width: deskW * 0.4,
            height: isMain ? 22 : 16,
            transform: 'translateZ(32px)',
          }}
        >
          {/* Scanlines */}
          {isActive && <div className="screen-lines absolute inset-0" />}
          {/* Working dots */}
          {isWorking && (
            <div className="absolute inset-0 flex items-center justify-center gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full animate-pulse-dot"
                  style={{
                    background: 'hsl(var(--monitor-glow))',
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desk lamp */}
      <div
        className="absolute"
        style={{
          bottom: deskH + 24,
          left: 24,
        }}
      >
        <div className="desk-lamp-arm" style={{ width: 2, height: 18 }}>
          <div
            className={`desk-lamp-head absolute -top-1 -left-[3px] ${isActive ? 'active animate-lamp-flicker' : 'dim'}`}
          />
        </div>
      </div>

      {/* Agent figure */}
      <div
        className="agent-figure absolute flex flex-col items-center"
        style={{
          bottom: deskH + 24,
          left: 20 + deskW * 0.55,
        }}
      >
        {/* Head */}
        <div className={`agent-head ${isWorking ? 'working' : 'idle'}`} />
        {/* Torso */}
        <div className={`agent-torso ${isWorking ? 'working' : ''}`} />
        {/* Arms */}
        <div className="agent-arms">
          <div className={`agent-arm ${isWorking ? 'typing-left' : ''}`} />
          <div className={`agent-arm ${isWorking ? 'typing-right' : ''}`} />
        </div>
      </div>

      {/* Nameplate (below desk, un-transformed for readability) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        style={{ bottom: 0 }}
      >
        <div className="flex items-center gap-1 bg-secondary/80 px-2 py-0.5 rounded-sm border border-border/50">
          <span className="text-xs">{agent.emoji}</span>
          <span className="text-[10px] font-semibold text-foreground whitespace-nowrap">
            {agent.displayName}
          </span>
        </div>
        {/* Status dot */}
        <div className="flex items-center gap-1">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
              status === 'idle'
                ? 'bg-muted-foreground/40'
                : status === 'working'
                ? 'bg-primary status-pulse'
                : status === 'reading'
                ? 'bg-monitor-glow'
                : 'bg-green-500'
            }`}
          />
          <span className="text-[8px] text-muted-foreground capitalize">{status}</span>
        </div>
      </div>

      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.06), transparent 70%)',
        }}
      />
    </button>
  );
}
