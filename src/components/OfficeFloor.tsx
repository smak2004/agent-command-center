import { Suspense, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useAgents, useChat, getBackendUrl, setBackendUrl } from '@/hooks/useAgents';
import { ChatPanel } from './ChatPanel';
import { PipelinePanel } from './PipelinePanel';

// ─── Character definitions ────────────────────────────────────────────────────
interface CharDef {
  skin: string; hair: string; hairStyle: 'short'|'long'|'bun'|'bald';
  outfit: string; outfitAccent: string; pants: string; shoes: string;
  accessory: 'glasses'|'headphones'|'tie'|'cap'|'none';
  accessoryColor: string;
}

const CHARACTERS: Record<string, CharDef> = {
  claude: {
    skin: '#d4956a', hair: '#1a0a00', hairStyle: 'short',
    outfit: '#111111', outfitAccent: '#F59E0B', pants: '#1a1a1a', shoes: '#0a0a0a',
    accessory: 'none', accessoryColor: '#F59E0B',
  },
  cipher: {
    skin: '#c0b090', hair: '#1a1a2e', hairStyle: 'short',
    outfit: '#0d1117', outfitAccent: '#22d3ee', pants: '#0a0a14', shoes: '#0a0a0a',
    accessory: 'glasses', accessoryColor: '#22d3ee',
  },
  vance: {
    skin: '#e8d0b0', hair: '#3a2a1a', hairStyle: 'short',
    outfit: '#1a1a3e', outfitAccent: '#a78bfa', pants: '#0f0f2a', shoes: '#111',
    accessory: 'none', accessoryColor: '#a78bfa',
  },
  omar: {
    skin: '#c8906a', hair: '#1a0a00', hairStyle: 'short',
    outfit: '#1e2a1e', outfitAccent: '#4ade80', pants: '#0a140a', shoes: '#111',
    accessory: 'glasses', accessoryColor: '#4ade80',
  },
  sophie: {
    skin: '#f0c8a0', hair: '#8b4513', hairStyle: 'long',
    outfit: '#4a1e3a', outfitAccent: '#f472b6', pants: '#2a1228', shoes: '#1a0a12',
    accessory: 'none', accessoryColor: '#f472b6',
  },
  levi: {
    skin: '#d4956a', hair: '#1a0a00', hairStyle: 'short',
    outfit: '#1e2a3a', outfitAccent: '#60a5fa', pants: '#0f1a28', shoes: '#0a0a0a',
    accessory: 'headphones', accessoryColor: '#60a5fa',
  },
  bolt: {
    skin: '#e8c890', hair: '#1a1a1a', hairStyle: 'short',
    outfit: '#1a1a1a', outfitAccent: '#F59E0B', pants: '#111', shoes: '#0a0a0a',
    accessory: 'none', accessoryColor: '#F59E0B',
  },
};

const DEFAULT_CHAR: CharDef = {
  skin: '#c8906a', hair: '#1a0a00', hairStyle: 'short',
  outfit: '#1e293b', outfitAccent: '#64748b', pants: '#0f172a', shoes: '#111',
  accessory: 'none', accessoryColor: '#fff',
};

// ─── Wander destinations ──────────────────────────────────────────────────────
const WANDER_SPOTS: [number, number, number][] = [
  [ 8.5, 0, -2.5],  // sofa
  [ 9.5, 0, -3.0],  // sofa
  [ 9.0, 0, -2.0],  // sofa
  [ 1.5, 0,  7.5],  // billiards
  [-1.5, 0,  7.5],  // billiards
  [ 0,   0,  7.0],  // billiards center
  [-8.5, 0, -2.5],  // meeting room
  [-9.0, 0, -3.5],  // meeting room
  [-10,  0,  6  ],  // plant corner
  [ 10,  0,  6  ],  // plant corner
  [ 0,   0,  5.5],  // chill area
];

// ─── Parquet texture ──────────────────────────────────────────────────────────
function useParquetTexture() {
  return useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const pw = 64, ph = 20;
    const colors = ['#a07848','#b08858','#906838','#aa7e50','#987048'];
    for (let row = 0; row < size / ph + 1; row++) {
      for (let col = 0; col < size / pw + 1; col++) {
        const x = col * pw, y = row * ph;
        ctx.fillStyle = colors[(row * 3 + col * 2) % colors.length];
        ctx.fillRect(x, y, pw - 1, ph - 1);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.5;
        for (let g = 4; g < pw - 2; g += 10) {
          ctx.beginPath(); ctx.moveTo(x+g, y); ctx.lineTo(x+g+2, y+ph-1); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
        ctx.strokeRect(x+0.5, y+0.5, pw-1.5, ph-1.5);
      }
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(32, 24);
    return t;
  }, []);
}

// ─── Floor plant ──────────────────────────────────────────────────────────────
function FloorPlant({ position }: { position: [number,number,number] }) {
  return (
    <group position={position}>
      <mesh position={[0,0.13,0]}><cylinderGeometry args={[0.18,0.14,0.26,10]} /><meshStandardMaterial color="#3d2b1f" roughness={0.9} /></mesh>
      <mesh position={[0,0.27,0]}><cylinderGeometry args={[0.17,0.17,0.02,10]} /><meshStandardMaterial color="#1a0f08" /></mesh>
      <mesh position={[0,0.6,0]}><cylinderGeometry args={[0.04,0.06,0.6,6]} /><meshStandardMaterial color="#2d1a0a" roughness={0.9} /></mesh>
      <mesh position={[0,1.0,0]}><sphereGeometry args={[0.28,8,8]} /><meshStandardMaterial color="#1a5c2a" roughness={0.9} /></mesh>
      <mesh position={[0.18,0.85,0.1]}><sphereGeometry args={[0.18,8,8]} /><meshStandardMaterial color="#236b33" roughness={0.9} /></mesh>
      <mesh position={[-0.15,0.9,-0.1]}><sphereGeometry args={[0.2,8,8]} /><meshStandardMaterial color="#1e6030" roughness={0.9} /></mesh>
      <mesh position={[0,1.15,0]}><sphereGeometry args={[0.15,8,8]} /><meshStandardMaterial color="#2a7a3a" roughness={0.9} /></mesh>
    </group>
  );
}

// ─── Ceiling light ────────────────────────────────────────────────────────────
function CeilingLight({ position }: { position: [number,number,number] }) {
  return (
    <group position={position}>
      <mesh><boxGeometry args={[0.4,0.03,0.1]} /><meshStandardMaterial color="#1a1a1a" metalness={0.9} /></mesh>
      <mesh position={[0,-0.02,0]}><boxGeometry args={[0.36,0.005,0.08]} /><meshStandardMaterial color="#fffde7" emissive="#fffde7" emissiveIntensity={3} /></mesh>
      <pointLight position={[0,-0.5,0]} color="#fff8e0" intensity={3} distance={7} decay={1.5} />
    </group>
  );
}

// ─── Billiards table ──────────────────────────────────────────────────────────
function BilliardTable({ position }: { position: [number,number,number] }) {
  const ballRef = useRef<THREE.Mesh>(null);
  const ball2Ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ballRef.current) { ballRef.current.position.x = Math.sin(t * 0.6) * 0.5; ballRef.current.position.z = Math.cos(t * 0.4) * 0.3; }
    if (ball2Ref.current) { ball2Ref.current.position.x = Math.sin(t * 0.5 + 1) * 0.4; ball2Ref.current.position.z = Math.cos(t * 0.7) * 0.35; }
  });
  const ballColors = ['#fff','#f5c518','#1a4fd6','#d62020','#6b21a8','#f97316','#16a34a','#7c3aed'];
  return (
    <group position={position}>
      {/* Legs */}
      {([[-1.1,-0.5,-0.6],[1.1,-0.5,-0.6],[-1.1,-0.5,0.6],[1.1,-0.5,0.6]] as [number,number,number][]).map((p,i) => (
        <mesh key={i} position={p}><boxGeometry args={[0.1,1.0,0.1]} /><meshStandardMaterial color="#2d1a0a" metalness={0.4} /></mesh>
      ))}
      {/* Rail */}
      <mesh position={[0,0.05,0]}><boxGeometry args={[2.4,0.15,1.4]} /><meshStandardMaterial color="#1a3a1a" roughness={0.6} /></mesh>
      {/* Felt surface */}
      <mesh position={[0,0.13,0]}><boxGeometry args={[2.2,0.04,1.2]} /><meshStandardMaterial color="#166534" roughness={0.9} /></mesh>
      {/* Pockets */}
      {([[-1.05,0.14,-0.55],[1.05,0.14,-0.55],[-1.05,0.14,0.55],[1.05,0.14,0.55],[0,0.14,-0.57],[0,0.14,0.57]] as [number,number,number][]).map((p,i) => (
        <mesh key={i} position={p}><cylinderGeometry args={[0.065,0.065,0.05,8]} /><meshStandardMaterial color="#0a0a0a" /></mesh>
      ))}
      {/* Balls */}
      {ballColors.map((color, i) => (
        <mesh key={i} {...(i === 0 ? { ref: ballRef } : i === 1 ? { ref: ball2Ref } : {})}
          position={[(i % 4 - 1.5) * 0.22, 0.18, (Math.floor(i/4) - 0.5) * 0.22]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color={color} roughness={0.1} metalness={0.3} />
        </mesh>
      ))}
      {/* Cue sticks on wall */}
      {[-0.3, 0, 0.3].map((z, i) => (
        <mesh key={i} position={[-1.4, 0.5, z]} rotation={[0, 0, Math.PI/8]}>
          <cylinderGeometry args={[0.015, 0.025, 1.4, 6]} />
          <meshStandardMaterial color="#8b5e3c" roughness={0.6} />
        </mesh>
      ))}
      <pointLight position={[0, 2, 0]} color="#fff8e0" intensity={2} distance={4} decay={2} />
      <Text position={[0, 1.2, -0.8]} fontSize={0.18} color="#4ade80" anchorX="center" outlineWidth={0.012} outlineColor="#000">🎱 Pool Table</Text>
    </group>
  );
}

// ─── Coffee cup prop ──────────────────────────────────────────────────────────
function CoffeeCup({ position }: { position: [number,number,number] }) {
  return (
    <group position={position}>
      <mesh><cylinderGeometry args={[0.04,0.03,0.08,8]} /><meshStandardMaterial color="#1a1a1a" roughness={0.5} /></mesh>
      <mesh position={[0,0.04,0]}><cylinderGeometry args={[0.038,0.038,0.005,8]} /><meshStandardMaterial color="#3d1c02" roughness={0.8} /></mesh>
    </group>
  );
}

// ─── Papers ───────────────────────────────────────────────────────────────────
function Papers({ position }: { position: [number,number,number] }) {
  return (
    <group position={position}>
      {[0,0.003,0.006].map((y,i) => (
        <mesh key={i} position={[0,y,0]} rotation={[0,(i*0.1)-0.1,0]}>
          <boxGeometry args={[0.12,0.002,0.16]} />
          <meshStandardMaterial color={i===0?'#f5f5f0':'#e8e8e0'} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Meeting room ─────────────────────────────────────────────────────────────
function MeetingRoom({ position }: { position: [number,number,number] }) {
  const chairAngles = [0,60,120,180,240,300].map(d => d*Math.PI/180);
  return (
    <group position={position}>
      {/* Floor mat */}
      <mesh position={[0,0.01,0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[3.8,3.8]} />
        <meshStandardMaterial color="#1e2a1e" roughness={0.9} />
      </mesh>
      {/* Meeting room label on floor */}
      <Text position={[0,0.05,1.6]} rotation={[-Math.PI/2,0,0]} fontSize={0.25} color="#4ade80" anchorX="center" outlineWidth={0.02} outlineColor="#000">
        🏢 Meeting Room
      </Text>
      {/* Corner posts — slim */}
      {([[-1.8,0.8,-1.8],[1.8,0.8,-1.8],[-1.8,0.8,1.8],[1.8,0.8,1.8]] as [number,number,number][]).map((p,i) => (
        <mesh key={i} position={p}><boxGeometry args={[0.06,1.6,0.06]} /><meshStandardMaterial color="#666" metalness={0.9} roughness={0.1} /></mesh>
      ))}
      {/* Table */}
      <mesh position={[0,0.72,0]}><cylinderGeometry args={[1.0,1.0,0.06,20]} /><meshStandardMaterial color="#5a3e2b" roughness={0.4} /></mesh>
      <mesh position={[0,0.36,0]}><cylinderGeometry args={[0.06,0.1,0.72,8]} /><meshStandardMaterial color="#2a1a0a" metalness={0.4} /></mesh>
      <mesh position={[0,0.04,0]}><cylinderGeometry args={[0.35,0.35,0.06,10]} /><meshStandardMaterial color="#222" metalness={0.6} /></mesh>
      {/* Chairs */}
      {chairAngles.map((angle,i) => (
        <group key={i} position={[Math.sin(angle)*1.45,0,Math.cos(angle)*1.45]} rotation={[0,angle+Math.PI,0]}>
          <mesh position={[0,0.28,0]}><boxGeometry args={[0.38,0.05,0.38]} /><meshStandardMaterial color="#1e293b" roughness={0.8} /></mesh>
          <mesh position={[0,0.55,0.18]}><boxGeometry args={[0.38,0.5,0.05]} /><meshStandardMaterial color="#1e293b" roughness={0.8} /></mesh>
        </group>
      ))}
      <pointLight position={[0,3,0]} color="#fff8e0" intensity={1.5} distance={5} decay={2} />
      <Text position={[0,2.7,-1.9]} fontSize={0.2} color="#F59E0B" anchorX="center" outlineWidth={0.015} outlineColor="#000">Meeting Room</Text>
    </group>
  );
}

// ─── Chill lounge ─────────────────────────────────────────────────────────────
function ChillLounge({ position }: { position: [number,number,number] }) {
  return (
    <group position={position}>
      {/* Rug */}
      <mesh position={[0,0.01,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[2.0,24]} /><meshStandardMaterial color="#3d1a4e" roughness={1} /></mesh>
      {/* Rug pattern ring */}
      <mesh position={[0,0.012,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.4,1.8,24]} /><meshStandardMaterial color="#5d2a6e" roughness={1} /></mesh>
      {/* Sofa visible from top */}
      <mesh position={[0,0.45,-1.0]}>
        <boxGeometry args={[2.4,0.08,0.72]} />
        <meshStandardMaterial color="#4444aa" roughness={0.9} emissive="#2222aa" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0,0.28,-1.0]}><boxGeometry args={[2.4,0.32,0.72]} /><meshStandardMaterial color="#1a1a3e" roughness={0.9} /></mesh>
      <mesh position={[0,0.65,-1.22]}><boxGeometry args={[2.4,0.55,0.16]} /><meshStandardMaterial color="#16162a" roughness={0.9} /></mesh>
      {[-1.2,1.2].map((x,i) => (
        <mesh key={i} position={[x,0.45,-1.0]}><boxGeometry args={[0.16,0.32,0.72]} /><meshStandardMaterial color="#16162a" roughness={0.9} /></mesh>
      ))}
      <mesh position={[0,0.22,0.3]}><boxGeometry args={[0.9,0.05,0.55]} /><meshStandardMaterial color="#3d2b1f" roughness={0.4} /></mesh>
      <mesh position={[0,0.1,0.3]}><boxGeometry args={[0.85,0.2,0.5]} /><meshStandardMaterial color="#111" metalness={0.5} /></mesh>
      <mesh position={[0.2,0.27,0.22]}><cylinderGeometry args={[0.06,0.05,0.1,8]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[-1.5,1.85,-0.9]}><sphereGeometry args={[0.12,8,8]} /><meshStandardMaterial color="#fffde7" emissive="#fffde7" emissiveIntensity={2} /></mesh>
      <mesh position={[-1.5,0.9,-0.9]}><cylinderGeometry args={[0.025,0.025,1.9,6]} /><meshStandardMaterial color="#333" metalness={0.8} /></mesh>
      <pointLight position={[-1.5,1.8,-0.8]} color="#fff5cc" intensity={1.5} distance={4} decay={2} />
      <Text position={[0,2.1,-1.3]} fontSize={0.18} color="#a78bfa" anchorX="center" outlineWidth={0.015} outlineColor="#000">Chill Zone</Text>
    </group>
  );
}

// ─── Agent figure with full state machine ─────────────────────────────────────
function AgentFigure({
  agent, backendStatus, deskPosition, isSelected, isMain, onClick
}: {
  agent: any; backendStatus: string;
  deskPosition: [number,number,number];
  isSelected: boolean; isMain: boolean; onClick: () => void;
}) {
  const char = CHARACTERS[agent.id] || DEFAULT_CHAR;
  const groupRef   = useRef<THREE.Group>(null);
  const bodyRef    = useRef<THREE.Group>(null);
  const headRef    = useRef<THREE.Group>(null);
  const armsRef    = useRef<THREE.Group>(null);
  const monitorRef = useRef<THREE.MeshStandardMaterial>(null);
  const lampRef    = useRef<THREE.PointLight>(null);

  // Position / movement
  const curPos  = useRef(new THREE.Vector3(...deskPosition));
  const tgtPos  = useRef(new THREE.Vector3(...deskPosition));
  const curFace = useRef(Math.PI); // facing toward camera by default
  const tgtFace = useRef(Math.PI);

  // State machine
  type AgentState = 'at-desk' | 'walking-away' | 'roaming' | 'walking-back';
  const agentState  = useRef<AgentState>('at-desk');
  const stateTimer  = useRef(Math.random() * 20 + 15);
  const phase       = useRef(Math.random() * Math.PI * 2);
  const isWorking   = backendStatus === 'working';
  const scale       = isMain ? 1.5 : 1.0;

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const p = phase.current;

    // ── State machine ──
    stateTimer.current -= delta;

    if (isWorking) {
      // Snap back to desk
      tgtPos.current.set(...deskPosition);
      tgtFace.current = Math.PI;
      agentState.current = 'walking-back';
    } else if (agentState.current === 'at-desk' && stateTimer.current <= 0) {
      const spot = WANDER_SPOTS[Math.floor(Math.random() * WANDER_SPOTS.length)];
      tgtPos.current.set(...spot);
      agentState.current = 'walking-away';
      stateTimer.current = 8 + Math.random() * 12;
    } else if (agentState.current === 'walking-away') {
      if (curPos.current.distanceTo(tgtPos.current) < 0.2) {
        agentState.current = 'roaming';
        // Wander nearby
        stateTimer.current = 6 + Math.random() * 8;
        const jitter: [number,number,number] = [
          tgtPos.current.x + (Math.random()-0.5)*1.5,
          0,
          tgtPos.current.z + (Math.random()-0.5)*1.5,
        ];
        tgtPos.current.set(...jitter);
      }
    } else if (agentState.current === 'roaming' && stateTimer.current <= 0) {
      tgtPos.current.set(...deskPosition);
      tgtFace.current = Math.PI;
      agentState.current = 'walking-back';
    } else if (agentState.current === 'walking-back') {
      if (curPos.current.distanceTo(tgtPos.current) < 0.2) {
        agentState.current = 'at-desk';
        stateTimer.current = Math.random() * 25 + 15;
      }
    }

    // ── Position lerp ──
    curPos.current.lerp(tgtPos.current, Math.min(delta * 2.5, 1));

    // ── Face direction of travel ──
    const moveDir = tgtPos.current.clone().sub(curPos.current);
    if (moveDir.length() > 0.15) {
      tgtFace.current = Math.atan2(moveDir.x, moveDir.z);
    }
    curFace.current += (tgtFace.current - curFace.current) * Math.min(delta * 6, 1);

    if (groupRef.current) {
      groupRef.current.position.copy(curPos.current);
      groupRef.current.rotation.y = curFace.current;
    }

    const isMoving = agentState.current === 'walking-away' || agentState.current === 'walking-back' || agentState.current === 'roaming';
    const isAtDesk = agentState.current === 'at-desk';

    // ── Body animations ──
    if (bodyRef.current) {
      if (isMoving) {
        // Walking bob
        bodyRef.current.position.y = Math.abs(Math.sin(t * 8 + p)) * 0.06;
        bodyRef.current.rotation.z = Math.sin(t * 4 + p) * 0.05;
      } else if (isWorking) {
        bodyRef.current.position.y = Math.sin(t * 6 + p) * 0.008;
        bodyRef.current.rotation.z = 0;
      } else {
        bodyRef.current.position.y = Math.sin(t * 1.2 + p) * 0.012;
        bodyRef.current.rotation.z = 0;
      }
    }

    if (armsRef.current) {
      if (isMoving) {
        // Swing arms while walking
        armsRef.current.rotation.x = Math.sin(t * 8 + p) * 0.4;
      } else if (isWorking && isAtDesk) {
        armsRef.current.position.y = Math.sin(t * 10 + p) * 0.04;
        armsRef.current.position.z = Math.sin(t * 10 + p) * 0.018;
        armsRef.current.rotation.x = 0;
      } else {
        armsRef.current.position.y = Math.sin(t * 1.0 + p) * 0.008;
        armsRef.current.rotation.x = 0;
      }
    }

    if (headRef.current) {
      if (isMoving) {
        headRef.current.rotation.x = 0;
        headRef.current.rotation.y = Math.sin(t * 2 + p) * 0.15;
      } else if (isWorking) {
        headRef.current.rotation.x = Math.sin(t * 5 + p) * 0.08;
        headRef.current.rotation.y = Math.sin(t * 1.5 + p) * 0.1;
      } else {
        headRef.current.rotation.x = 0;
        headRef.current.rotation.y = Math.sin(t * 0.4 + p) * 0.2;
      }
    }

    if (monitorRef.current) {
      monitorRef.current.emissiveIntensity = isWorking ? 0.8 + Math.sin(t*4)*0.2 : 0.4;
    }
    if (lampRef.current) {
      lampRef.current.intensity = isWorking ? 2.8 + Math.sin(t*2)*0.5 : 0.5;
    }
  });

  const atDesk = ['at-desk', 'walking-back'].includes(agentState.current as string);

  return (
    <>
      {/* Desk — stays fixed */}
      <group position={deskPosition} scale={[scale, scale, scale]} rotation={[0, Math.PI, 0]}>
        {isMain && (
          <>
            {/* Raised gold platform — visible from top */}
            <mesh position={[0,-0.1,0]} rotation={[-Math.PI/2,0,0]}>
              <circleGeometry args={[1.4,32]} />
              <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.5} transparent opacity={0.7} />
            </mesh>
            <mesh position={[0,-0.12,0]}><boxGeometry args={[2.2,0.08,1.8]} /><meshStandardMaterial color="#1c1c1c" metalness={0.5} roughness={0.5} /></mesh>
          </>
        )}
        <mesh position={[0,0,0]} castShadow onClick={(e)=>{e.stopPropagation();onClick()}} onPointerOver={()=>{document.body.style.cursor='pointer'}} onPointerOut={()=>{document.body.style.cursor='auto'}}>
          <boxGeometry args={[1.3,0.08,0.95]} />
          <meshStandardMaterial color={isMain?'#5a3e2b':'#3d2b1f'} roughness={0.55} />
        </mesh>
        {([[-0.55,-0.25,-0.38],[0.55,-0.25,-0.38],[-0.55,-0.25,0.38],[0.55,-0.25,0.38]] as [number,number,number][]).map((p,i)=>(
          <mesh key={i} position={p}><boxGeometry args={[0.06,0.5,0.06]} /><meshStandardMaterial color="#1a1212" /></mesh>
        ))}
        <mesh position={[0,0.18,-0.3]}><boxGeometry args={[0.04,0.22,0.04]} /><meshStandardMaterial color="#222" metalness={0.7} /></mesh>
        <mesh position={[0,0.36,-0.3]}><boxGeometry args={[0.52,0.34,0.04]} /><meshStandardMaterial color="#0a0a0a" metalness={0.8} /></mesh>
        <mesh position={[0,0.36,-0.27]}>
          <planeGeometry args={[0.44,0.27]} />
          <meshStandardMaterial ref={monitorRef} color={isWorking?'#F59E0B':'#22d3ee'} emissive={isWorking?'#F59E0B':'#22d3ee'} emissiveIntensity={0.4} transparent opacity={0.97} />
        </mesh>
        <mesh position={[0.52,0.22,-0.3]}><cylinderGeometry args={[0.016,0.016,0.32,8]} /><meshStandardMaterial color="#444" metalness={0.85} /></mesh>
        <mesh position={[0.43,0.36,-0.3]} rotation={[-Math.PI/2,0,0]}><cylinderGeometry args={[0.09,0.05,0.06,8]} /><meshStandardMaterial color="#222" metalness={0.5} /></mesh>
        <pointLight ref={lampRef} position={[0.43,0.32,-0.28]} color="#F59E0B" intensity={0.5} distance={3.5} decay={2} />
        <mesh position={[0.25,0.045,0]} rotation={[-Math.PI/2,0,0]}>
          <circleGeometry args={[0.55,16]} />
          <meshStandardMaterial color="#F59E0B" transparent opacity={isWorking?0.12:0.04} emissive="#F59E0B" emissiveIntensity={isWorking?0.3:0.06} />
        </mesh>
        {isSelected && (
          <mesh position={[0,-0.02,0]} rotation={[-Math.PI/2,0,0]}>
            <ringGeometry args={[0.85,0.98,32]} />
            <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={2.5} transparent opacity={0.9} />
          </mesh>
        )}
        <CoffeeCup position={[-0.45,0.07,0.2]} />
        <Papers position={[0.35,0.045,0.1]} />
        <mesh position={[0,0.08,0.6]}>
          <sphereGeometry args={[0.042,8,8]} />
          <meshStandardMaterial color={isWorking?'#F59E0B':'#374151'} emissive={isWorking?'#F59E0B':'#000'} emissiveIntensity={isWorking?2.5:0} />
        </mesh>
        {/* Label flat on floor — readable from top-down */}
        <Text position={[0,0.1,0.9]} rotation={[-Math.PI/2,0,Math.PI]} fontSize={0.18} color={isSelected?'#F59E0B':'#ffffff'} anchorX="center" maxWidth={2} outlineWidth={0.02} outlineColor="#000000">
          {agent.emoji} {agent.displayName}
        </Text>
        {/* Chair */}
        <mesh position={[0,0.52,0.36]}><boxGeometry args={[0.32,0.38,0.05]} /><meshStandardMaterial color="#0f172a" roughness={0.9} /></mesh>
        <mesh position={[0,0.3,0.22]}><boxGeometry args={[0.32,0.05,0.3]} /><meshStandardMaterial color="#0f172a" roughness={0.9} /></mesh>
      </group>

      {/* Moving agent figure */}
      <group ref={groupRef} position={deskPosition} scale={[scale,scale,scale]} onClick={(e)=>{e.stopPropagation();onClick()}} onPointerOver={()=>{document.body.style.cursor='pointer'}} onPointerOut={()=>{document.body.style.cursor='auto'}}>
        <group ref={bodyRef}>
          {/* ── Head ── */}
          <group ref={headRef} position={[0,0.72,0]}>
            {/* Neck */}
            <mesh position={[0,-0.1,0]}><cylinderGeometry args={[0.042,0.048,0.1,10]} /><meshStandardMaterial color={char.skin} roughness={0.8} /></mesh>
            {/* Head */}
            <mesh castShadow>
              <sphereGeometry args={[0.11,16,16]} />
              <meshStandardMaterial color={char.skin} roughness={0.8} />
            </mesh>
            {/* Eyes */}
            <mesh position={[-0.04,0.02,0.1]}><sphereGeometry args={[0.016,8,8]} /><meshStandardMaterial color="#fff" /></mesh>
            <mesh position={[0.04,0.02,0.1]}><sphereGeometry args={[0.016,8,8]} /><meshStandardMaterial color="#fff" /></mesh>
            <mesh position={[-0.04,0.02,0.112]}><sphereGeometry args={[0.009,6,6]} /><meshStandardMaterial color="#1a0a00" /></mesh>
            <mesh position={[0.04,0.02,0.112]}><sphereGeometry args={[0.009,6,6]} /><meshStandardMaterial color="#1a0a00" /></mesh>
            {/* Eyebrows */}
            <mesh position={[-0.04,0.05,0.108]} rotation={[0,0,0.15]}><boxGeometry args={[0.03,0.006,0.004]} /><meshStandardMaterial color={char.hair} /></mesh>
            <mesh position={[0.04,0.05,0.108]} rotation={[0,0,-0.15]}><boxGeometry args={[0.03,0.006,0.004]} /><meshStandardMaterial color={char.hair} /></mesh>
            {/* Nose */}
            <mesh position={[0,-0.01,0.108]}><sphereGeometry args={[0.01,6,6]} /><meshStandardMaterial color={char.skin} roughness={0.8} /></mesh>
            {/* Mouth */}
            <mesh position={[0,-0.04,0.106]} rotation={[0,0,0]}><boxGeometry args={[0.035,0.007,0.004]} /><meshStandardMaterial color="#8b4040" /></mesh>
            {/* Ears */}
            <mesh position={[-0.108,0.01,0]}><sphereGeometry args={[0.022,8,8]} /><meshStandardMaterial color={char.skin} roughness={0.8} /></mesh>
            <mesh position={[0.108,0.01,0]}><sphereGeometry args={[0.022,8,8]} /><meshStandardMaterial color={char.skin} roughness={0.8} /></mesh>
            {/* Hair */}
            {char.hairStyle === 'short' && (
              <mesh position={[0,0.06,0]}>
                <sphereGeometry args={[0.112,14,10,0,Math.PI*2,0,Math.PI/2.2]} />
                <meshStandardMaterial color={char.hair} roughness={1} />
              </mesh>
            )}
            {char.hairStyle === 'long' && (
              <>
                <mesh position={[0,0.06,0]}><sphereGeometry args={[0.112,14,10,0,Math.PI*2,0,Math.PI/2.2]} /><meshStandardMaterial color={char.hair} roughness={1} /></mesh>
                <mesh position={[0,-0.04,-0.06]}><boxGeometry args={[0.18,0.18,0.06]} /><meshStandardMaterial color={char.hair} roughness={1} /></mesh>
              </>
            )}
            {char.hairStyle === 'bun' && (
              <>
                <mesh position={[0,0.06,0]}><sphereGeometry args={[0.112,14,10,0,Math.PI*2,0,Math.PI/2.2]} /><meshStandardMaterial color={char.hair} roughness={1} /></mesh>
                <mesh position={[0,0.16,-0.04]}><sphereGeometry args={[0.055,8,8]} /><meshStandardMaterial color={char.hair} roughness={1} /></mesh>
              </>
            )}
            {/* Accessories */}
            {char.accessory === 'glasses' && (
              <group position={[0,0.02,0.1]}>
                <mesh position={[-0.04,0,0]}><torusGeometry args={[0.025,0.004,6,14]} /><meshStandardMaterial color={char.accessoryColor} metalness={0.8} roughness={0.2} /></mesh>
                <mesh position={[0.04,0,0]}><torusGeometry args={[0.025,0.004,6,14]} /><meshStandardMaterial color={char.accessoryColor} metalness={0.8} roughness={0.2} /></mesh>
                <mesh position={[0,0,0]}><boxGeometry args={[0.02,0.003,0.003]} /><meshStandardMaterial color={char.accessoryColor} metalness={0.8} /></mesh>
              </group>
            )}
            {char.accessory === 'headphones' && (
              <group>
                <mesh position={[0,0.1,0]}><torusGeometry args={[0.12,0.012,6,16,Math.PI]} /><meshStandardMaterial color={char.accessoryColor} roughness={0.3} /></mesh>
                <mesh position={[-0.115,0.0,0]}><sphereGeometry args={[0.032,8,8]} /><meshStandardMaterial color={char.accessoryColor} roughness={0.3} /></mesh>
                <mesh position={[0.115,0.0,0]}><sphereGeometry args={[0.032,8,8]} /><meshStandardMaterial color={char.accessoryColor} roughness={0.3} /></mesh>
              </group>
            )}
            {char.accessory === 'cap' && (
              <group position={[0,0.1,0]}>
                <mesh position={[0,0.04,0]}><cylinderGeometry args={[0.1,0.12,0.08,14]} /><meshStandardMaterial color={char.accessoryColor} roughness={0.8} /></mesh>
                <mesh position={[0,0.01,0.1]} rotation={[-0.2,0,0]}><boxGeometry args={[0.18,0.02,0.1]} /><meshStandardMaterial color={char.accessoryColor} roughness={0.8} /></mesh>
              </group>
            )}
          </group>

          {/* ── Torso ── */}
          <group position={[0,0.46,0]}>
            {/* Shirt/jacket body */}
            <mesh castShadow>
              <boxGeometry args={[0.22,0.26,0.15]} />
              <meshStandardMaterial color={char.outfit} roughness={0.8} />
            </mesh>
            {/* Collar */}
            <mesh position={[0,0.12,0.07]}>
              <boxGeometry args={[0.1,0.06,0.02]} />
              <meshStandardMaterial color={char.outfitAccent} roughness={0.6} />
            </mesh>
            {/* Tie/accent stripe */}
            {char.accessory === 'tie' && (
              <mesh position={[0,0.0,0.076]}>
                <boxGeometry args={[0.03,0.18,0.005]} />
                <meshStandardMaterial color={char.accessoryColor} roughness={0.6} />
              </mesh>
            )}
            {/* Shirt detail line */}
            <mesh position={[0,0.0,0.076]}>
              <boxGeometry args={[0.005,0.22,0.004]} />
              <meshStandardMaterial color={char.outfitAccent} roughness={0.5} />
            </mesh>
          </group>

          {/* ── Arms ── */}
          <group ref={armsRef} position={[0,0.46,0]}>
            {/* Upper arms */}
            <mesh position={[-0.15,0.02,0]}><cylinderGeometry args={[0.042,0.038,0.18,8]} /><meshStandardMaterial color={char.outfit} roughness={0.8} /></mesh>
            <mesh position={[0.15,0.02,0]}><cylinderGeometry args={[0.042,0.038,0.18,8]} /><meshStandardMaterial color={char.outfit} roughness={0.8} /></mesh>
            {/* Forearms */}
            <mesh position={[-0.155,-0.14,0.04]} rotation={[0.3,0,0]}><cylinderGeometry args={[0.034,0.03,0.16,8]} /><meshStandardMaterial color={char.skin} roughness={0.8} /></mesh>
            <mesh position={[0.155,-0.14,0.04]} rotation={[0.3,0,0]}><cylinderGeometry args={[0.034,0.03,0.16,8]} /><meshStandardMaterial color={char.skin} roughness={0.8} /></mesh>
            {/* Hands */}
            <mesh position={[-0.156,-0.24,0.07]}><sphereGeometry args={[0.032,8,8]} /><meshStandardMaterial color={char.skin} roughness={0.8} /></mesh>
            <mesh position={[0.156,-0.24,0.07]}><sphereGeometry args={[0.032,8,8]} /><meshStandardMaterial color={char.skin} roughness={0.8} /></mesh>
          </group>

          {/* ── Legs ── */}
          <mesh position={[-0.065,0.2,0]} castShadow><cylinderGeometry args={[0.052,0.046,0.38,10]} /><meshStandardMaterial color={char.pants} roughness={0.9} /></mesh>
          <mesh position={[0.065,0.2,0]} castShadow><cylinderGeometry args={[0.052,0.046,0.38,10]} /><meshStandardMaterial color={char.pants} roughness={0.9} /></mesh>

          {/* ── Shoes ── */}
          <mesh position={[-0.065,0.03,0.05]} rotation={[-0.2,0,0]}><boxGeometry args={[0.072,0.05,0.16]} /><meshStandardMaterial color={char.shoes} roughness={0.4} metalness={0.2} /></mesh>
          <mesh position={[0.065,0.03,0.05]} rotation={[-0.2,0,0]}><boxGeometry args={[0.072,0.05,0.16]} /><meshStandardMaterial color={char.shoes} roughness={0.4} metalness={0.2} /></mesh>
        </group>
      </group>
    </>
  );
}

// ─── Desk positions ───────────────────────────────────────────────────────────
const DESK_POSITIONS: Record<string, [number,number,number]> = {
  claude:   [ 0,   0, -3  ],
  cipher:   [-3,   0, -3  ],
  vance:    [ 3,   0,  0  ],
  omar:     [-4.5, 0,  4  ],
  sophie:   [ 4.5, 0,  4  ],
  levi:     [ 1.5, 0,  4  ],
  bolt:     [-1.5, 0,  4  ],
};

const ENERGY_LINES: [[number,number,number],[number,number,number]][] = [
  [[0,0.5,-3],[-3,  0.5,-3 ]],  // claude → cipher
  [[0,0.5,-3],[ 3,  0.5, 0 ]],  // claude → vance
  [[0,0.5,-3],[-4.5,0.5, 4 ]],  // claude → omar
  [[0,0.5,-3],[ 4.5,0.5, 4 ]],  // claude → sophie
  [[0,0.5,-3],[ 1.5,0.5, 4 ]],  // claude → levi
  [[0,0.5,-3],[-1.5,0.5, 4 ]],  // claude → bolt
];

// ─── Energy line ──────────────────────────────────────────────────────────────
function EnergyLine({ from, to, active }: { from:[number,number,number]; to:[number,number,number]; active:boolean }) {
  const ref = useRef<any>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      (ref.current.material as THREE.LineBasicMaterial).opacity = active
        ? 0.4 + Math.sin(clock.elapsedTime * 4) * 0.3 : 0.05;
    }
  });
  const points = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]);
    return geo;
  }, [from, to]);
  return (
    <line ref={ref} geometry={points}>
      <lineBasicMaterial color="#F59E0B" transparent opacity={0.05} />
    </line>
  );
}

// ─── Particles ────────────────────────────────────────────────────────────────
function Particles() {
  const mesh = useRef<THREE.Points>(null);
  const count = 100;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i*3]   = (Math.random()-0.5)*28;
      arr[i*3+1] = Math.random()*6;
      arr[i*3+2] = (Math.random()-0.5)*20;
    }
    return arr;
  }, []);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const pos = mesh.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i*3+1] += Math.sin(clock.elapsedTime*0.4+i)*0.003;
      if (pos[i*3+1] > 6) pos[i*3+1] = 0;
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={mesh}>
      <bufferGeometry><bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} /></bufferGeometry>
      <pointsMaterial color="#F59E0B" size={0.04} transparent opacity={0.3} sizeAttenuation />
    </points>
  );
}

// ─── Pipeline active indicator ────────────────────────────────────────────────
function PipelineActiveIndicator({ active }: { active: boolean }) {
  const ringRef  = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;
    if (ringRef.current) {
      (ringRef.current.material as THREE.MeshStandardMaterial).opacity = active ? 0.06 + pulse * 0.12 : 0;
    }
    if (lightRef.current) {
      lightRef.current.intensity = active ? 1.5 + pulse * 2 : 0;
    }
  });
  return (
    <group>
      <mesh ref={ringRef} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.5, 6.5, 64]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={2} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 3, 0]} color="#22d3ee" intensity={0} distance={14} decay={2} />
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ agents, statuses, selectedAgent, onSelectAgent, pipelineActive }: any) {
  const parquet = useParquetTexture();
  const jarvisWorking = statuses['claude'] === 'working';

  return (
    <>
      <ambientLight intensity={3.5} color="#fff8f0" />
      <directionalLight position={[0,20,0]} intensity={3} color="#ffffff" />
      <directionalLight position={[-10,16,8]} intensity={2} color="#fff5e0" />
      <directionalLight position={[10,16,-8]} intensity={2} color="#fff5e0" />
      <pointLight position={[0,15,0]} intensity={5} color="#fff8f0" distance={60} decay={1} />

      {/* Floor */}
      <mesh position={[0,-0.05,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[28,22]} />
        <meshStandardMaterial map={parquet} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Walls — lower (h=2.5) */}
      {([
        [0,1.25,-10,30,2.5,0,0],
        [0,1.25,10,30,2.5,Math.PI,0],
        [-12,1.25,0,20,2.5,0,Math.PI/2],
        [12,1.25,0,20,2.5,0,-Math.PI/2],
      ] as [number,number,number,number,number,number,number][]).map(([x,y,z,w,h,_,ry],i) => (
        <mesh key={i} position={[x,y,z]} rotation={[0,ry,0]}>
          <planeGeometry args={[w,h]} />
          <meshStandardMaterial color="#2e2420" roughness={0.85} />
        </mesh>
      ))}

      {/* Amber baseboard strip */}
      {([
        [0,0.12,-11.9,40,0.25,0,0],
        [-14.9,0.12,0,0.25,24,0,Math.PI/2],
        [14.9,0.12,0,0.25,24,0,Math.PI/2],
      ] as any[]).map(([x,y,z,w,d,_,ry],i) => (
        <mesh key={i} position={[x,y,z]} rotation={[0,ry,0]}>
          <planeGeometry args={[w,d]} />
          <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.35} transparent opacity={0.45} />
        </mesh>
      ))}

      {/* Back window glow */}
      <mesh position={[0,3.5,-11.85]}><planeGeometry args={[8,3]} /><meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.12} transparent opacity={0.15} /></mesh>
      <pointLight position={[0,3.5,-10]} color="#F59E0B" intensity={2.5} distance={12} decay={2} />

      {/* Whiteboard — on left inner wall of meeting room area */}
      <mesh position={[-11.5,1.5,-5.5]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[3,1.6]} /><meshStandardMaterial color="#e8f4f0" roughness={0.9} emissive="#fff" emissiveIntensity={0.06} /></mesh>
      <pointLight position={[-11,2,-5.5]} color="#ffffff" intensity={1} distance={4} decay={2} />

      {/* Partition wall */}
      <mesh position={[0,0.45,2]}><boxGeometry args={[11,0.9,0.08]} /><meshStandardMaterial color="#1e1e2e" roughness={0.8} metalness={0.2} /></mesh>

      {/* Ceiling lights — just above wall height */}
      {[[-5,1],[-1.5,1],[1.5,1],[5,1],[-4,5],[0,5],[4,5],[0,-2],[-8,-2],[8,-2]].map(([x,z],i) => (
        <CeilingLight key={i} position={[x,3.2,z]} />
      ))}

      {/* Pipeline active glow ring */}
      <PipelineActiveIndicator active={pipelineActive} />

      {/* Particles */}
      <Particles />

      {/* Energy lines */}
      {ENERGY_LINES.map(([from,to],i) => (
        <EnergyLine key={i} from={from} to={to} active={jarvisWorking} />
      ))}

      {/* Furniture */}
      <MeetingRoom position={[-9,0,-3]} />
      <ChillLounge position={[9,0,-3]} />
      <BilliardTable position={[0,0,7]} />

      {/* Plants */}
      {([[-11,0,8],[11,0,8],[-11,0,-8],[11,0,-8],[0,0,-9],[-6,0,-9],[6,0,-9]] as [number,number,number][]).map((p,i) => (
        <FloorPlant key={i} position={p} />
      ))}

      {/* Agent figures + desks — only render agents with known desk positions */}
      {agents.filter((agent: any) => DESK_POSITIONS[agent.id] !== undefined).map((agent: any) => (
        <AgentFigure
          key={agent.id}
          agent={agent}
          backendStatus={statuses[agent.id] || 'idle'}
          deskPosition={DESK_POSITIONS[agent.id]}
          isMain={agent.isDefault || agent.id === 'claude'}
          isSelected={selectedAgent?.id === agent.id}
          onClick={() => onSelectAgent(agent)}
        />
      ))}

      <OrbitControls
        enableRotate={false}
        enablePan={false}
        enableZoom={true}
        minDistance={8}
        maxDistance={40}
      />
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function OfficeFloor() {
  const { agents, statuses, loading, connected } = useAgents();
  const { sendMessage, getMessages, sending } = useChat();
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState(getBackendUrl());
  const navigate = useNavigate();

  // Pipeline state
  const [pipelineActive, setPipelineActive] = useState(false);
  const [pipelineAgentWork, setPipelineAgentWork] = useState<Record<string, 'working' | 'idle'>>({});

  // Merge backend statuses with pipeline-driven working states
  const mergedStatuses = useMemo(() => {
    const merged = { ...statuses };
    Object.entries(pipelineAgentWork).forEach(([id, state]) => {
      if (state === 'working') merged[id] = 'working';
    });
    return merged;
  }, [statuses, pipelineAgentWork]);

  const handleAgentWorkingChange = useCallback((s: Record<string, 'working' | 'idle'>) => {
    setPipelineAgentWork(s);
  }, []);

  const handlePipelineActiveChange = useCallback((active: boolean) => {
    setPipelineActive(active);
  }, []);

  return (
    <div style={{ width:'100vw', height:'100vh', background:'#0a0a0a', color:'white', fontFamily:'sans-serif', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color:'#F59E0B', fontSize:20 }}>⬡</span>
          <span style={{ fontWeight:700, fontSize:15, letterSpacing:'0.05em' }}>JARVIS HQ</span>
          <span style={{ color:'rgba(255,255,255,0.25)', fontSize:12 }}>Command Center</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background:connected?'rgba(74,222,128,0.12)':'rgba(248,113,113,0.12)', color:connected?'#4ade80':'#f87171', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'currentColor', display:'inline-block' }} />
            {connected ? 'Live' : 'Demo'}
          </span>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>
            {Object.values(mergedStatuses).filter(s=>s!=='idle').length} working · {agents.length} agents
          </span>
          <PipelinePanel
            onAgentWorkingChange={handleAgentWorkingChange}
            onPipelineActiveChange={handlePipelineActiveChange}
            pipelineActive={pipelineActive}
          />
          <button
            onClick={() => navigate('/pipeline')}
            style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', color:'#f59e0b', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
            📊 PHO Pipeline
          </button>
          <button onClick={()=>setShowSettings(s=>!s)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)', borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:12 }}>
            ⚙ Settings
          </button>
        </div>
      </div>

      {showSettings && (
        <div style={{ position:'absolute', top:52, right:16, zIndex:999, background:'#111', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:16, width:300, boxShadow:'0 20px 60px rgba(0,0,0,0.9)' }}>
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginBottom:8 }}>Backend URL</div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://xxxx.ngrok-free.app"
              style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'none', borderRadius:8, padding:'7px 10px', color:'white', fontSize:12, outline:'none' }} />
            <button onClick={()=>{ setBackendUrl(urlInput); setShowSettings(false); }} style={{ background:'#F59E0B', border:'none', borderRadius:8, padding:'7px 12px', color:'black', fontWeight:700, fontSize:12, cursor:'pointer' }}>Save</button>
          </div>
          <div style={{ color:'rgba(255,255,255,0.2)', fontSize:10, marginTop:8 }}>Current: {getBackendUrl()}</div>
        </div>
      )}

      <div style={{ flex:1, minHeight:0, marginRight:selectedAgent?420:0, transition:'margin 0.3s', overflow:'hidden' }}>
        {loading ? (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
            <div style={{ fontSize:48 }}>🤖</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>Initializing Jarvis HQ...</div>
          </div>
        ) : (
          <Canvas camera={{ position:[18,18,18], fov:45 }} style={{ width:'100%', height:'100%', display:'block' }} shadows
            onCreated={({ gl })=>{ gl.setClearColor('#0a0a0a'); gl.shadowMap.enabled=true; gl.shadowMap.type=THREE.PCFSoftShadowMap; }}>
            <Suspense fallback={null}>
              <Scene agents={agents} statuses={mergedStatuses} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} pipelineActive={pipelineActive} />
            </Suspense>
          </Canvas>
        )}
      </div>

      {selectedAgent && (
        <ChatPanel agent={selectedAgent} messages={getMessages(selectedAgent.id)} sending={sending}
          onSend={(msg:string)=>sendMessage(msg,selectedAgent.id)} onClose={()=>setSelectedAgent(null)} />
      )}
    </div>
  );
}
