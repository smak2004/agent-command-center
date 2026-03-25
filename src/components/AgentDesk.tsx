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

  return (
    <button
      onClick={onClick}
      className={`
        relative group cursor-pointer transition-all duration-300
        ${isMain ? 'col-span-2 md:col-span-3' : ''}
      `}
    >
      {/* Desk platform */}
      <div className={`
        relative rounded-xl p-4 transition-all duration-500
        bg-card border border-border
        ${isActive ? 'border-primary/40 shadow-[0_0_30px_rgba(245,158,11,0.15)]' : 'hover:border-primary/20 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]'}
        ${isMain ? 'p-6' : ''}
      `}>
        {/* Lamp */}
        <div className="absolute top-2 right-3 flex flex-col items-center">
          <div className={`
            w-1.5 h-6 rounded-full transition-all duration-500
            ${isActive ? 'bg-lamp-warm' : 'bg-muted-foreground/20'}
          `} />
          <div className={`
            w-4 h-2 rounded-full -mt-0.5 transition-all duration-500
            ${isActive ? 'bg-lamp-warm shadow-[0_0_12px_rgba(251,191,36,0.6)]' : 'bg-muted-foreground/10'}
            ${isWorking ? 'animate-lamp' : ''}
          `} />
        </div>

        {/* Agent figure */}
        <div className={`
          flex flex-col items-center mb-3
          ${isHandoff ? 'animate-handoff' : ''}
        `}>
          {/* Head */}
          <div className={`
            rounded-full flex items-center justify-center transition-all duration-300
            ${isMain ? 'w-12 h-12 text-2xl' : 'w-9 h-9 text-lg'}
            ${isActive ? 'bg-primary/20' : 'bg-muted'}
          `}>
            {agent.emoji}
          </div>
          
          {/* Body */}
          <div className={`
            rounded-md mt-1 transition-all duration-300
            ${isMain ? 'w-10 h-6' : 'w-7 h-4'}
            bg-agent-body/40
            ${isWorking ? 'animate-typing' : ''}
            ${isReading ? 'translate-y-[-2px]' : ''}
          `} />

          {/* Reading document */}
          {isReading && (
            <div className="absolute top-8 right-8 animate-reading">
              <div className="w-5 h-7 bg-primary/30 rounded-sm border border-primary/40" />
            </div>
          )}
        </div>

        {/* Monitor */}
        <div className={`
          mx-auto rounded-md border transition-all duration-500 flex items-center justify-center
          ${isMain ? 'w-20 h-12' : 'w-14 h-8'}
          ${isWorking ? 'bg-monitor-glow/20 border-monitor-glow/40 animate-monitor-glow' : ''}
          ${isReading ? 'bg-monitor-glow/15 border-monitor-glow/30' : ''}
          ${!isActive ? 'bg-monitor-dim/30 border-muted-foreground/10 animate-screensaver' : ''}
        `}>
          {isWorking && (
            <div className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-monitor-glow animate-pulse-dot"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Nameplate */}
        <div className={`
          mt-3 text-center transition-all duration-300
          ${isActive ? 'text-foreground' : 'text-muted-foreground'}
        `}>
          <div className={`font-semibold ${isMain ? 'text-sm' : 'text-xs'}`}>
            {agent.displayName}
          </div>
          <div className={`text-[10px] mt-0.5 opacity-60 ${isMain ? '' : 'hidden md:block'}`}>
            {agent.tag}
          </div>
        </div>

        {/* Status indicator */}
        <div className={`
          absolute top-2 left-2 w-2 h-2 rounded-full transition-all duration-500
          ${status === 'idle' ? 'bg-muted-foreground/30' : ''}
          ${status === 'working' ? 'bg-primary shadow-[0_0_6px_rgba(245,158,11,0.8)]' : ''}
          ${status === 'reading' ? 'bg-monitor-glow shadow-[0_0_6px_rgba(96,165,250,0.6)]' : ''}
          ${status === 'handoff' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : ''}
        `} />
      </div>
    </button>
  );
}
