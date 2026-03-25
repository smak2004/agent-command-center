import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { Agent, AgentStatus } from '@/hooks/useAgents';

interface AgentDesk3DProps {
  agent: Agent;
  status: AgentStatus;
  position: [number, number, number];
  isMain?: boolean;
  isSelected?: boolean;
  onClick: () => void;
}

export function AgentDesk3D({ agent, status, position, isMain, isSelected, onClick }: AgentDesk3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const armsRef = useRef<THREE.Group>(null);
  const monitorRef = useRef<THREE.MeshStandardMaterial>(null);
  const lampRef = useRef<THREE.PointLight>(null);
  const [hovered, setHovered] = useState(false);

  const isWorking = status === 'working';
  const scale = isMain ? 1.4 : 1.0;
  const monitorColor = isWorking ? '#F59E0B' : '#22d3ee';

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Hover scale
    const target = hovered ? scale * 1.06 : scale;
    const cur = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(cur + (target - cur) * 0.1);

    // Typing animation
    if (armsRef.current) {
      armsRef.current.position.y = isWorking ? Math.sin(t * 8) * 0.04 : 0;
      armsRef.current.position.z = isWorking ? Math.sin(t * 8) * 0.02 : 0;
    }

    // Monitor pulse
    if (monitorRef.current) {
      monitorRef.current.emissiveIntensity = isWorking ? 0.7 + Math.sin(t * 3) * 0.3 : 0.4;
    }

    // Lamp brightness
    if (lampRef.current) {
      lampRef.current.intensity = isWorking
        ? 2.0 + Math.sin(t * 2) * 0.4
        : hovered ? 0.9 : 0.35;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      scale={[scale, scale, scale]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
    >
      {/* Raised platform for main agent */}
      {isMain && (
        <mesh position={[0, -0.09, 0]}>
          <boxGeometry args={[2.0, 0.1, 1.6]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.4} roughness={0.6} />
        </mesh>
      )}

      {/* Desk top */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.4, 0.08, 1.0]} />
        <meshStandardMaterial color={isMain ? '#4a3728' : '#2d2018'} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Desk legs */}
      {([ [-0.6, -0.25, -0.4], [0.6, -0.25, -0.4], [-0.6, -0.25, 0.4], [0.6, -0.25, 0.4] ] as [number,number,number][]).map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <meshStandardMaterial color="#1a1212" roughness={0.8} />
        </mesh>
      ))}

      {/* Monitor stand */}
      <mesh position={[0, 0.15, -0.3]}>
        <boxGeometry args={[0.04, 0.2, 0.04]} />
        <meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Monitor body */}
      <mesh position={[0, 0.33, -0.3]}>
        <boxGeometry args={[0.5, 0.32, 0.04]} />
        <meshStandardMaterial color="#111" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Monitor screen */}
      <mesh position={[0, 0.33, -0.27]}>
        <planeGeometry args={[0.42, 0.26]} />
        <meshStandardMaterial
          ref={monitorRef}
          color={monitorColor}
          emissive={monitorColor}
          emissiveIntensity={0.4}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Lamp pole */}
      <mesh position={[0.55, 0.22, -0.3]}>
        <cylinderGeometry args={[0.018, 0.018, 0.3, 8]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Lamp head */}
      <mesh position={[0.44, 0.35, -0.3]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.08, 0.1, 8, 1, true]} />
        <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} side={THREE.BackSide} />
      </mesh>

      {/* Lamp light */}
      <pointLight
        ref={lampRef}
        position={[0.44, 0.30, -0.28]}
        color="#F59E0B"
        intensity={0.35}
        distance={3}
        decay={2}
      />

      {/* Desk lamp glow */}
      <mesh position={[0.3, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshStandardMaterial color="#F59E0B" transparent opacity={isWorking ? 0.1 : 0.03} emissive="#F59E0B" emissiveIntensity={isWorking ? 0.2 : 0.04} />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 0.95, 32]} />
          <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={1.5} transparent opacity={0.7} />
        </mesh>
      )}

      {/* Head */}
      <mesh position={[0, 0.68, -0.12]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#f5cba7" roughness={0.8} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 0.47, -0.08]}>
        <boxGeometry args={[0.2, 0.24, 0.13]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>

      {/* Arms (animated) */}
      <group ref={armsRef} position={[0, 0.47, -0.08]}>
        <mesh position={[-0.15, 0, 0.05]}>
          <boxGeometry args={[0.07, 0.2, 0.07]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        <mesh position={[0.15, 0, 0.05]}>
          <boxGeometry args={[0.07, 0.2, 0.07]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
      </group>

      {/* Chair back */}
      <mesh position={[0, 0.54, 0.34]}>
        <boxGeometry args={[0.32, 0.38, 0.05]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Chair seat */}
      <mesh position={[0, 0.3, 0.22]}>
        <boxGeometry args={[0.32, 0.05, 0.3]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Name label */}
      <Text
        position={[0, -0.05, 0.62]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.1}
        color={isSelected ? '#F59E0B' : '#aaaaaa'}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.5}
      >
        {agent.emoji} {agent.displayName}
      </Text>

      {/* Status dot */}
      <mesh position={[0, 0.07, 0.62]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color={isWorking ? '#F59E0B' : '#374151'}
          emissive={isWorking ? '#F59E0B' : '#000000'}
          emissiveIntensity={isWorking ? 1.5 : 0}
        />
      </mesh>
    </group>
  );
}
