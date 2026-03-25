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

  const handleSelectAgent = (agent: Agent) => setSelectedAgent(agent);
  const handleSend = (message: string) => {
    if (selectedAgent) sendMessage(message, selectedAgent.id);
  };

  return (
    <div className="w-screen h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/5 z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-amber-500 text-lg">⬡</span>
          <h1 className="text-sm font-semibold text-white tracking-wide">Jarvis HQ</h1>
          <span className="text-xs text-white/30">Command Center</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
            connected
              ? 'text-green-400 bg-green-400/10'
              : 'text-red-400 bg-red-400/10'
          }`}>
            {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span>{connected ? 'Live' : 'Demo'}</span>
          </div>

          {/* Backend URL */}
          <span className="text-[10px] text-white/20 font-mono hidden md:block max-w-[180px] truncate">
            {getBackendUrl()}
          </span>

          {/* Active agents */}
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.8)]" />
            {Object.values(statuses).filter(s => s !== 'idle').length} active
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(s => !s)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute top-14 right-4 z-30 bg-[#161616] border border-white/10 rounded-xl p-4 w-80 shadow-2xl">
          <label className="text-xs text-white/40 mb-2 block">Backend URL</label>
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setBackendUrl(urlInput)}
              placeholder="https://your-ngrok-url.ngrok-free.app"
              className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            <button
              onClick={() => setBackendUrl(urlInput)}
              className="px-3 py-2 rounded-lg bg-amber-500 text-black text-sm font-medium hover:bg-amber-400 transition-colors flex items-center gap-1.5"
            >
              <Check size={13} /> Save
            </button>
          </div>
          <p className="text-[10px] text-white/20 mt-2">Saved to localStorage. Reloads on save.</p>
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
