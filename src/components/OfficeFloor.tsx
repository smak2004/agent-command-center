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

function GridLine({ points, color }: { points: [number,number,number][]; color: string }) {
  const ref = useRef<THREE.BufferGeometry>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.setFromPoints(points.map(p => new THREE.Vector3(...p)));
    }
  }, [points]);
  return (
    <line>
      <bufferGeometry ref={ref} />
      <lineBasicMaterial color={color} />
    </line>
  );
}

function FloorGrid() {
  const lines = [];
  for (let i = -10; i <= 10; i++) {
    lines.push(
      <GridLine key={`h${i}`} points={[[-10, 0, i], [10, 0, i]]} color="#1f1f1f" />,
      <GridLine key={`v${i}`} points={[[i, 0, -10], [i, 0, 10]]} color="#1f1f1f" />
    );
  }
  return <>{lines}</>;
}

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
      <ambientLight intensity={0.3} color="#fff8f0" />
      <directionalLight position={[-8, 12, 6]} intensity={0.8} color="#fff5e0" castShadow />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#F59E0B" distance={20} decay={2} />

      {/* Floor */}
      <mesh position={[0, -0.06, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#111111" roughness={0.95} />
      </mesh>

      {/* Grid lines */}
      <FloorGrid />

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
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#F59E0B', fontSize: 18 }}>⬡</span>
          <h1 style={{ color: 'white', fontSize: 14, fontWeight: 600, margin: 0 }}>Jarvis HQ</h1>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Command Center</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 10px', borderRadius: 99, background: connected ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: connected ? '#4ade80' : '#f87171' }}>
            {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span>{connected ? 'Live' : 'Demo'}</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {getBackendUrl()}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 6px #F59E0B' }} />
            {Object.values(statuses).filter(s => s !== 'idle').length} active
          </div>
          <button onClick={() => setShowSettings(s => !s)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ position: 'absolute', top: 56, right: 16, zIndex: 30, background: '#161616', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, width: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 8 }}>Backend URL</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setBackendUrl(urlInput)}
              placeholder="https://your-ngrok-url.ngrok-free.app"
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'white', outline: 'none' }}
            />
            <button onClick={() => setBackendUrl(urlInput)} style={{ padding: '8px 12px', borderRadius: 8, background: '#F59E0B', border: 'none', color: 'black', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={13} /> Save
            </button>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <div style={{ flex: 1, marginRight: selectedAgent ? 420 : 0, transition: 'margin 0.3s ease', position: 'relative' }}>
        {loading ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 40 }}>🤖</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Initializing Jarvis HQ...</div>
          </div>
        ) : (
          <Canvas
            camera={{ position: [12, 10, 12], fov: 45 }}
            shadows
            style={{ width: '100%', height: '100%', background: '#0a0a0a' }}
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
