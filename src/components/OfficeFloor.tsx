import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { Agent, useAgents, useChat, getBackendUrl, setBackendUrl } from '@/hooks/useAgents';
import { AgentDesk3D } from './AgentDesk3D';
import { ChatPanel } from './ChatPanel';
import { Settings, Check, Wifi, WifiOff } from 'lucide-react';

// Desk positions: [x, y, z]
// Jarvis at center, pipeline agents arranged in a U-shape
const DESK_POSITIONS: Record<string, [number, number, number]> = {
  claude:           [0,    0,  0   ],
  'pho-research':   [-4,   0,  3   ],
  'pho-concept':    [-2,   0,  3   ],
  'pho-script':     [2,    0,  3   ],
  'pho-brand':      [4,    0,  3   ],
  'pho-creative':   [-4,   0, -2   ],
  'pho-distribution':[-2,  0, -2   ],
  'pho-growth':     [2,    0, -2   ],
};

function Scene({
  agents,
  statuses,
  selectedAgent,
  onSelectAgent,
}: {
  agents: Agent[];
  statuses: Record<string, string>;
  selectedAgent: Agent | null;
  onSelectAgent: (a: Agent) => void;
}) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.25} color="#fff8f0" />
      <directionalLight
        position={[-8, 12, 6]}
        intensity={0.8}
        color="#fff5e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[0, 8, 0]} intensity={0.4} color="#F59E0B" distance={20} decay={2} />

      {/* Floor */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[22, 0.1, 16]} />
        <meshStandardMaterial color="#111111" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Floor grid */}
      <Grid
        position={[0, 0, 0]}
        args={[22, 16]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#1f1f1f"
        sectionSize={4}
        sectionThickness={0.5}
        sectionColor="#2a2a2a"
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid={false}
      />

      {/* Center ambient glow on floor */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.5, 32]} />
        <meshStandardMaterial
          color="#F59E0B"
          transparent
          opacity={0.03}
          emissive="#F59E0B"
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Agent desks */}
      {agents.map((agent) => {
        const pos = DESK_POSITIONS[agent.id] || [0, 0, 0];
        return (
          <AgentDesk3D
            key={agent.id}
            agent={agent}
            status={(statuses[agent.id] as any) || 'idle'}
            position={pos}
            isMain={agent.isDefault}
            isSelected={selectedAgent?.id === agent.id}
            onClick={() => onSelectAgent(agent)}
          />
        );
      })}

      {/* Camera controls — limited to roughly isometric feel */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={6}
        maxDistance={22}
        target={[0, 0, 0]}
      />
    </>
  );
}

export function OfficeFloor() {
  const { agents, statuses, loading, connected } = useAgents();
  const { sendMessage, getMessages, sending } = useChat();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState(getBackendUrl());

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
    if (selectedAgent) sendMessage(message, selectedAgent.id);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient lighting */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 10%, hsl(38 92% 50% / 0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 90%, hsl(190 80% 55% / 0.03) 0%, transparent 40%)
          `,
        }}
      />

      <div className={`relative z-10 transition-all duration-300 ${selectedAgent ? 'mr-[400px]' : ''}`}>
        {/* Header */}
        <header className="pt-6 pb-4 px-6">
          <div className="flex items-center justify-between">
            <div className="w-10" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                <span className="text-primary">⬡</span> Jarvis HQ
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Command Center</p>
            </div>
            <button
              onClick={() => setBackendUrl(urlInput)}
              className="px-3 py-2 rounded-lg bg-amber-500 text-black text-sm font-medium hover:bg-amber-400 transition-colors flex items-center gap-1.5"
            >
              <Check size={13} /> Save
            </button>
          </div>

          {/* Settings dropdown */}
          {showSettings && (
            <div className="max-w-md mx-auto mt-4 bg-card border border-border rounded-xl p-4">
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

          {/* Status bar */}
          <div className="flex items-center justify-center gap-4 mt-3">
            {!connected && (
              <div className="flex items-center gap-1.5 text-xs text-destructive/80 bg-destructive/10 px-2.5 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                Disconnected
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

        {/* ISOMETRIC OFFICE SCENE */}
        <div className="iso-scene flex items-center justify-center py-8">
          <div className="iso-floor relative" style={{ width: 700, height: 500 }}>
            {/* Floor grid */}
            <div
              className="absolute inset-0"
              style={{
                background: 'hsl(0 0% 6.5%)',
                backgroundImage: `
                  linear-gradient(hsl(0 0% 10%) 1px, transparent 1px),
                  linear-gradient(90deg, hsl(0 0% 10%) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
                borderRadius: 4,
              }}
            />

            {/* Boss platform + desk */}
            {mainAgent && (
              <div className="absolute" style={{ top: 40, left: '50%', transform: 'translateX(-50%)' }}>
                {/* Raised platform */}
                <div className="platform-3d relative" style={{ width: 180, height: 100 }}>
                  <div className="platform-top absolute inset-0 rounded-sm" />
                  <div className="platform-front rounded-b-sm" />
                  <div className="platform-side rounded-r-sm" />
                </div>
                {/* Desk on platform */}
                <div className="absolute" style={{ top: 10, left: 30 }}>
                  <AgentDesk
                    agent={mainAgent}
                    status={statuses[mainAgent.id] || 'idle'}
                    isMain
                    onClick={() => handleSelectAgent(mainAgent)}
                  />
                </div>
              </div>
            )}

            {/* Pipeline agents — two rows */}
            {otherAgents.length > 0 && (
              <>
                {/* Row 1 */}
                <div
                  className="absolute flex gap-2 justify-center"
                  style={{ top: 220, left: '50%', transform: 'translateX(-50%)' }}
                >
                  {otherAgents.slice(0, 4).map((agent, i) => (
                    <div key={agent.id} style={{ marginTop: i % 2 === 1 ? 12 : 0 }}>
                      <AgentDesk
                        agent={agent}
                        status={statuses[agent.id] || 'idle'}
                        onClick={() => handleSelectAgent(agent)}
                      />
                    </div>
                  ))}
                </div>

                {/* Row 2 */}
                {otherAgents.length > 4 && (
                  <div
                    className="absolute flex gap-2 justify-center"
                    style={{ top: 370, left: '50%', transform: 'translateX(-50%)' }}
                  >
                    {otherAgents.slice(4, 8).map((agent, i) => (
                      <div key={agent.id} style={{ marginTop: i % 2 === 0 ? 8 : 0 }}>
                        <AgentDesk
                          agent={agent}
                          status={statuses[agent.id] || 'idle'}
                          onClick={() => handleSelectAgent(agent)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <div className={`flex-1 transition-all duration-300 ${selectedAgent ? 'mr-[420px]' : ''}`}>
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="text-4xl animate-pulse">🤖</div>
              <div className="text-white/40 text-sm">Initializing Jarvis HQ...</div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Canvas
            camera={{ position: [10, 10, 10], fov: 45 }}
            shadows
            gl={{ antialias: true, alpha: false }}
            style={{ background: '#0a0a0a' }}
          >
            <Suspense fallback={null}>
              <Scene
                agents={agents}
                statuses={statuses}
                selectedAgent={selectedAgent}
                onSelectAgent={handleSelectAgent}
              />
            </Suspense>
          </Canvas>
        )}
      </div>

      {/* Chat panel */}
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
      <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-primary status-pulse' : 'bg-muted-foreground/30'}`} />
      <span>{count} {label}</span>
    </div>
  );
}
