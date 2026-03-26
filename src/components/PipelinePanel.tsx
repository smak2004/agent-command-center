import { useState, useEffect, useCallback } from 'react';
import { getBackendUrl } from '@/hooks/useAgents';

const NGROK_HEADERS = { 'ngrok-skip-browser-warning': '1' };

type StageStatus = 'pending' | 'running' | 'complete' | 'failed';

interface PipelineStageRow {
  key: string;
  label: string;
  agentName: string;
  agentId: string | null;
  emoji: string;
  stageNums: number[];
}

const STAGE_ROWS: PipelineStageRow[] = [
  { key: 'stage1', label: 'Research',          agentName: 'Eren',  agentId: 'pho-research',      emoji: '🔍', stageNums: [1] },
  { key: 'stage2', label: 'Concept',           agentName: 'Mikasa',agentId: 'pho-concept',       emoji: '💡', stageNums: [2] },
  { key: 'stage3', label: 'Script',            agentName: 'Baelor',agentId: 'pho-script',        emoji: '📝', stageNums: [3] },
  { key: 'stage4', label: 'Brand',             agentName: 'Vega',  agentId: 'pho-brand',         emoji: '🎨', stageNums: [4] },
  { key: 'stage5', label: 'Creative',          agentName: 'Nova',  agentId: 'pho-creative',      emoji: '✨', stageNums: [5] },
  { key: 'stage67',label: 'Human Production',  agentName: '',      agentId: null,                emoji: '🎙️', stageNums: [6, 7] },
  { key: 'stage8', label: 'Distribution',      agentName: 'Atlas', agentId: 'pho-distribution',  emoji: '📡', stageNums: [8] },
  { key: 'stage9', label: 'Growth',            agentName: 'Rex',   agentId: 'pho-growth',        emoji: '📈', stageNums: [9] },
];

interface PipelineStatusData {
  clientId?: string;
  status?: string;
  stages?: Record<string, StageStatus>;
}

interface Props {
  onAgentWorkingChange: (agentStatuses: Record<string, 'working' | 'idle'>) => void;
  onPipelineActiveChange: (active: boolean) => void;
  pipelineActive: boolean;
}

function indicatorColor(s: StageStatus) {
  if (s === 'running')  return '#F59E0B';
  if (s === 'complete') return '#4ade80';
  if (s === 'failed')   return '#f87171';
  return '#374151';
}

export function PipelinePanel({ onAgentWorkingChange, onPipelineActiveChange, pipelineActive }: Props) {
  const [showModal, setShowModal]         = useState(false);
  const [showStatus, setShowStatus]       = useState(false);
  const [clientName, setClientName]       = useState('');
  const [brief, setBrief]                 = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [pipelineData, setPipelineData]   = useState<PipelineStatusData | null>(null);

  // Derive clientId slug from display name
  const clientId = clientName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // ── Submit new pipeline ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!clientId || !brief.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${getBackendUrl()}/pipeline/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...NGROK_HEADERS },
        body: JSON.stringify({ clientId, brief }),
      });
      setActiveClientId(clientId);
      setShowModal(false);
      setShowStatus(true);
      onPipelineActiveChange(true);
      setClientName('');
      setBrief('');
    } catch (e) {
      console.error('Pipeline start failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Resume after human production ───────────────────────────────────────────
  const handleResume = useCallback(async () => {
    if (!activeClientId) return;
    try {
      await fetch(`${getBackendUrl()}/pipeline/resume/${activeClientId}`, {
        method: 'POST',
        headers: NGROK_HEADERS,
      });
    } catch (e) {
      console.error('Pipeline resume failed:', e);
    }
  }, [activeClientId]);

  // ── Poll pipeline status ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeClientId) return;
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/pipeline/status/${activeClientId}`, { headers: NGROK_HEADERS });
        if (!res.ok) return;
        const data: PipelineStatusData = await res.json();
        if (!mounted) return;
        setPipelineData(data);

        // Compute which agents are pipeline-working
        const agentWork: Record<string, 'working' | 'idle'> = {};
        STAGE_ROWS.forEach(row => {
          if (!row.agentId) return;
          const s: StageStatus = data.stages?.[row.key] ?? 'pending';
          agentWork[row.agentId] = s === 'running' ? 'working' : 'idle';
        });
        onAgentWorkingChange(agentWork);

        const isActive = data.status !== 'complete' && data.status !== 'failed';
        onPipelineActiveChange(isActive);
      } catch {
        // ignore
      }
    };

    poll();
    const timer = setInterval(poll, 2000);
    return () => { mounted = false; clearInterval(timer); };
  }, [activeClientId, onAgentWorkingChange, onPipelineActiveChange]);

  // ── Resolve stage status ─────────────────────────────────────────────────────
  const getRowStatus = (row: PipelineStageRow): StageStatus => {
    if (row.key === 'stage67') {
      // Human production: treat as running when pipeline is awaiting-production
      if (pipelineData?.status === 'awaiting-production') return 'running';
      // If stage8 has started or is complete, human production was done
      const s8 = pipelineData?.stages?.['stage8'];
      if (s8 === 'running' || s8 === 'complete') return 'complete';
      return 'pending';
    }
    return pipelineData?.stages?.[row.key] ?? 'pending';
  };

  const overallStatus = pipelineData?.status;
  const awaitingProduction = overallStatus === 'awaiting-production';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Top-bar buttons (rendered inline by parent) ── */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.4)',
          color: '#F59E0B',
          borderRadius: 8,
          padding: '5px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        + New Client
      </button>

      {activeClientId && (
        <button
          onClick={() => setShowStatus(s => !s)}
          style={{
            background: pipelineActive ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${pipelineActive ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.08)'}`,
            color: pipelineActive ? '#22d3ee' : 'rgba(255,255,255,0.4)',
            borderRadius: 8,
            padding: '5px 10px',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {pipelineActive && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#22d3ee', display: 'inline-block',
              animation: 'pho-pulse 1.6s ease-in-out infinite',
            }} />
          )}
          Pipeline
        </button>
      )}

      {/* ── New Client Modal ────────────────────────────────────────────────── */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            background: '#111',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 28, width: 480,
            boxShadow: '0 40px 80px rgba(0,0,0,0.95)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>New Client</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>
                  Start the PHO podcast production pipeline
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {/* Client Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.08em', marginBottom: 7 }}>CLIENT NAME</label>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 8, padding: '9px 12px',
                  color: 'white', fontSize: 14, outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              {clientId && (
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 5 }}>
                  ID: <span style={{ color: 'rgba(255,255,255,0.35)' }}>{clientId}</span>
                </div>
              )}
            </div>

            {/* Brief */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.08em', marginBottom: 7 }}>BRIEF</label>
              <textarea
                value={brief}
                onChange={e => setBrief(e.target.value)}
                placeholder="Describe the podcast idea, target audience, tone, goals..."
                rows={5}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 8, padding: '9px 12px',
                  color: 'white', fontSize: 13, outline: 'none',
                  resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55,
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 8, padding: '9px 18px',
                  color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 13,
                  fontFamily: 'inherit',
                }}
              >Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!clientId || !brief.trim() || submitting}
                style={{
                  background: (clientId && brief.trim() && !submitting) ? '#F59E0B' : 'rgba(245,158,11,0.25)',
                  border: 'none', borderRadius: 8, padding: '9px 22px',
                  color: (clientId && brief.trim() && !submitting) ? '#000' : 'rgba(0,0,0,0.4)',
                  fontWeight: 700, fontSize: 13, cursor: (clientId && brief.trim() && !submitting) ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {submitting ? 'Starting...' : 'Run Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pipeline Status Panel ───────────────────────────────────────────── */}
      {showStatus && activeClientId && (
        <div style={{
          position: 'fixed', top: 60, left: 16, zIndex: 500,
          background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: 16, width: 255,
          boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
        }}>
          {/* Panel header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>{activeClientId}</div>
              <div style={{
                fontSize: 10, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.07em',
                color: overallStatus === 'complete' ? '#4ade80'
                     : overallStatus === 'failed'   ? '#f87171'
                     : overallStatus === 'awaiting-production' ? '#a78bfa'
                     : '#22d3ee',
              }}>
                {overallStatus ?? 'starting...'}
              </div>
            </div>
            <button
              onClick={() => setShowStatus(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}
            >×</button>
          </div>

          {/* Stage rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {STAGE_ROWS.map(row => {
              const s = getRowStatus(row);
              const running = s === 'running';
              const color = indicatorColor(s);
              const stageLabel = row.stageNums.length > 1
                ? `${row.stageNums[0]}-${row.stageNums[row.stageNums.length - 1]}`
                : `${row.stageNums[0]}`;
              return (
                <div
                  key={row.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '6px 8px', borderRadius: 8,
                    background: running ? 'rgba(245,158,11,0.07)' : 'transparent',
                    transition: 'background 0.3s',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: color,
                    boxShadow: running ? `0 0 8px ${color}` : 'none',
                    animation: running ? 'pho-pulse 1.5s ease-in-out infinite' : 'none',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12,
                      color: running ? 'white' : s === 'complete' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.4)',
                      fontWeight: running ? 600 : 400,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span style={{ fontSize: 11 }}>{row.emoji}</span>
                      <span>{stageLabel}. {row.label}</span>
                    </div>
                    {row.agentName && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 1 }}>{row.agentName}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                    {s}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resume button */}
          {awaitingProduction && (
            <button
              onClick={handleResume}
              style={{
                width: '100%', marginTop: 14,
                background: 'rgba(167,139,250,0.14)',
                border: '1px solid rgba(167,139,250,0.4)',
                color: '#a78bfa', borderRadius: 8, padding: '9px 12px',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              🎙️ Resume Pipeline
            </button>
          )}
        </div>
      )}

      {/* CSS keyframe for pulse animation */}
      <style>{`
        @keyframes pho-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.45; transform: scale(1.5); }
        }
      `}</style>
    </>
  );
}
