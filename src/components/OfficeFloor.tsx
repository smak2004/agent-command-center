import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Agent, useAgents, useChat, getBackendUrl, setBackendUrl } from '@/hooks/useAgents';
import { AgentDesk3D } from './AgentDesk3D';
import { ChatPanel } from './ChatPanel';
import { Settings, Check, Wifi, WifiOff } from 'lucide-react';

const DESK_POSITIONS: Record<string, [number, number, number]> = {
  claude:              [ 0,   0,  0  ],
  'pho-research':      [-4,   0,  3  ],
  'pho-concept':       [-2,   0,  3  ],
  'pho-script':        [ 2,   0,  3  ],
  'pho-brand':         [ 4,   0,  3  ],
  'pho-creative':      [-4,   0, -2  ],
  'pho-distribution':  [-2,   0, -2  ],
  'pho-growth':        [ 2,   0, -2  ],
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
      <ambientLight intensity={0.4} />
      <directionalLight position={[-8, 12, 6]} intensity={0.8} color="#fff5e0" />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#F59E0B" distance={20} decay={2} />

      {/* Floor */}
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#111111" roughness={0.95} />
      </mesh>

      {/* Agent desks */}
      {agents.map((agent) => {
        const pos = DESK_POSITIONS[agent.id] ?? [0, 0, 0];
        return (
          <AgentDesk3D
            key={agent.id}
            agent={agent}
            status={statuses[agent.id] as any ?? 'idle'}
            position={pos}
            isMain={agent.isDefault}
            isSelected={selectedAgent?.id === agent.id}
            onClick={() => onSelectAgent(agent)}
          />
        );
      })}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={6}
        maxDistance={22}
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
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#F59E0B', fontSize: 18 }}>⬡</span>
          <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Jarvis HQ</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Command Center</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: connected ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: connected ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: 5 }}>
            {connected ? '●' : '○'} {connected ? 'Live' : 'Demo'}
          </span>
          <button
            onClick={() => setShowSettings(s => !s)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', padding: 6 }}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div style={{ position: 'absolute', top: 52, right: 16, zIndex: 999, background: '#161616', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, width: 300, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 8 }}>Backend URL</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setBackendUrl(urlInput)}
              placeholder="https://xxxx.ngrok-free.app"
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '7px 10px', color: 'white', fontSize: 12, outline: 'none' }}
            />
            <button
              onClick={() => setBackendUrl(urlInput)}
              style={{ background: '#F59E0B', border: 'none', borderRadius: 8, padding: '7px 12px', color: 'black', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Check size={12} /> Save
            </button>
          </div>
        </div>
      )}

      {/* 3D Canvas area */}
      <div style={{ flex: 1, marginRight: selectedAgent ? 420 : 0, transition: 'margin 0.3s', minHeight: 0 }}>
        {loading ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 40 }}>🤖</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Initializing...</div>
          </div>
        ) : (
          <Canvas
            camera={{ position: [12, 10, 12], fov: 45 }}
            style={{ width: '100%', height: '100%' }}
            gl={{ antialias: true }}
            onCreated={({ gl }) => { gl.setClearColor('#0a0a0a'); }}
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
