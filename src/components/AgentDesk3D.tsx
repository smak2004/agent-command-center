import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
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
  const monitorGlowRef = useRef<THREE.MeshStandardMaterial>(null);
  const lampLightRef = useRef<THREE.PointLight>(null);
  const [hovered, setHovered] = useState(false);

  const isWorking = status === 'working';
  const scale = isMain ? 1.4 : 1.0;
  const deskColor = isMain ? '#4a3728' : '#2d2018';
  const monitorColor = isWorking ? '#F59E0B' : '#22d3ee';
  const lampIntensity = isWorking ? 2.5 : hovered ? 0.8 : 0.3;

  useFrame((state) => {
    if (!groupRef.current) return;

    // Hover scale
    const targetScale = hovered ? scale * 1.05 : scale;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

    // Typing animation when working
    if (armsRef.current && isWorking) {
      const t = state.clock.elapsedTime;
      armsRef.current.position.y = Math.sin(t * 8) * 0.04;
      armsRef.current.position.z = Math.sin(t * 8) * 0.02;
    } else if (armsRef.current) {
      armsRef.current.position.y = 0;
      armsRef.current.position.z = 0;
    }

    // Monitor glow pulse
    if (monitorGlowRef.current) {
      const t = state.clock.elapsedTime;
      const pulse = isWorking ? 0.8 + Math.sin(t * 3) * 0.2 : 0.5;
      monitorGlowRef.current.emissiveIntensity = pulse;
    }

    // Lamp light
    if (lampLightRef.current) {
      lampLightRef.current.intensity = isWorking
        ? 2.0 + Math.sin(state.clock.elapsedTime * 2) * 0.3
        : hovered ? 0.8 : 0.3;
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
      {/* Platform for main agent */}
      {isMain && (
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[1.8, 0.08, 1.4]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />
        </mesh>
      )}

      {/* Desk surface */}
      <RoundedBox args={[1.4, 0.08, 1.0]} radius={0.02} position={[0, 0, 0]}>
        <meshStandardMaterial color={deskColor} roughness={0.6} metalness={0.1} />
      </RoundedBox>

      {/* Desk legs */}
      {[[-0.6, -0.25, -0.4], [0.6, -0.25, -0.4], [-0.6, -0.25, 0.4], [0.6, -0.25, 0.4]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <meshStandardMaterial color="#1a1212" roughness={0.8} />
        </mesh>
      ))}

      {/* Monitor stand */}
      <mesh position={[0, 0.1, -0.3]}>
        <boxGeometry args={[0.04, 0.2, 0.04]} />
        <meshStandardMaterial color="#222" roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Monitor screen */}
      <mesh position={[0, 0.28, -0.3]}>
        <boxGeometry args={[0.5, 0.32, 0.03]} />
        <meshStandardMaterial color="#111" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Monitor screen glow */}
      <mesh position={[0, 0.28, -0.28]}>
        <planeGeometry args={[0.42, 0.26]} />
        <meshStandardMaterial
          ref={monitorGlowRef}
          color={monitorColor}
          emissive={monitorColor}
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Desk lamp pole */}
      <mesh position={[0.55, 0.18, -0.3]}>
        <cylinderGeometry args={[0.02, 0.02, 0.28, 8]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Desk lamp head */}
      <mesh position={[0.45, 0.32, -0.3]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.08, 0.1, 8, 1, true]} />
        <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} side={THREE.BackSide} />
      </mesh>

      {/* Lamp light */}
      <pointLight
        ref={lampLightRef}
        position={[0.45, 0.28, -0.28]}
        color="#F59E0B"
        intensity={lampIntensity}
        distance={2.5}
        decay={2}
      />

      {/* Lamp glow on desk surface */}
      <mesh position={[0.3, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 16]} />
        <meshStandardMaterial
          color="#F59E0B"
          transparent
          opacity={isWorking ? 0.12 : 0.04}
          emissive="#F59E0B"
          emissiveIntensity={isWorking ? 0.3 : 0.05}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 0.9, 32]} />
          <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={1} transparent opacity={0.6} />
        </mesh>
      )}

      {/* ── Agent figure ── */}
      {/* Head */}
      <mesh position={[0, 0.62, -0.15]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#f5cba7" roughness={0.8} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 0.42, -0.1]}>
        <boxGeometry args={[0.18, 0.22, 0.12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>

      {/* Arms group (animated when working) */}
      <group ref={armsRef} position={[0, 0.42, -0.1]}>
        {/* Left arm */}
        <mesh position={[-0.14, 0, 0.04]}>
          <boxGeometry args={[0.07, 0.18, 0.07]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        {/* Right arm */}
        <mesh position={[0.14, 0, 0.04]}>
          <boxGeometry args={[0.07, 0.18, 0.07]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
      </group>

      {/* Chair back */}
      <mesh position={[0, 0.5, 0.32]}>
        <boxGeometry args={[0.3, 0.35, 0.04]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>

      {/* Chair seat */}
      <mesh position={[0, 0.28, 0.22]}>
        <boxGeometry args={[0.3, 0.04, 0.28]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>

      {/* Nameplate */}
      <Text
        position={[0, -0.06, 0.6]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.1}
        color={isSelected ? '#F59E0B' : '#cccccc'}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.4}
      >
        {agent.emoji} {agent.displayName}
      </Text>

      {/* Status dot */}
      <mesh position={[0, 0.06, 0.6]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color={isWorking ? '#F59E0B' : '#4b5563'}
          emissive={isWorking ? '#F59E0B' : '#000'}
          emissiveIntensity={isWorking ? 1 : 0}
        />
      </mesh>
    </group>
  );
}
