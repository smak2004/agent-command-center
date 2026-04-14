import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getBackendUrl, setBackendUrl } from '@/hooks/useAgents';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StageFile {
  blueprint_pdf?: string | null;
  blueprint_md?: string | null;
  summary_pdf?: string | null;
}

interface CipherStage {
  status: StageStatus;
  completed_at: string | null;
}

interface ManusStage {
  status: StageStatus;
  task_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  files: StageFile;
}

interface VanceStage {
  status: StageStatus;
  completed_at: string | null;
  score: number | null;
  score_max: number;
  recommendation: 'approve' | 'revise' | 'reject' | null;
  section_scores: Record<string, number> | null;
  flags: Flag[];
}

interface ApprovalStage {
  status: StageStatus;
  approved_by: string | null;
  approved_at: string | null;
  revision_notes: string | null;
}

interface ClientSummaryStage {
  status: StageStatus;
  completed_at: string | null;
  files: StageFile;
}

interface Flag {
  section: string;
  severity: 'minor' | 'major' | 'critical';
  note: string;
}

type StageStatus = 'waiting' | 'in_progress' | 'complete' | 'needs_action';

interface VanceHistoryEntry {
  score: number | null;
  score_max: number;
  recommendation: 'approve' | 'revise' | 'reject' | null;
  completed_at: string | null;
}

interface ClientState {
  version: number;
  client: {
    id: string;
    name: string;
    show_name: string;
    folder: string;
    created_at: string;
    updated_at: string;
  };
  current_stage: string;
  pipeline: {
    cipher: CipherStage;
    manus: ManusStage;
    vance: VanceStage;
    approval: ApprovalStage;
    client_summary: ClientSummaryStage;
  };
  vance_history?: VanceHistoryEntry[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STAGES: { key: keyof ClientState['pipeline']; label: string; emoji: string }[] = [
  { key: 'cipher',         label: 'Cipher',         emoji: '🔐' },
  { key: 'manus',          label: 'Manus',           emoji: '🧠' },
  { key: 'vance',          label: 'Vance',           emoji: '🔬' },
  { key: 'approval',       label: 'Approval',        emoji: '✅' },
  { key: 'client_summary', label: 'Client Summary',  emoji: '📄' },
];

const NGROK_HEADERS = { 'ngrok-skip-browser-warning': '1' };

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusColor(status: StageStatus): string {
  switch (status) {
    case 'complete':     return '#4ade80';
    case 'in_progress':  return '#60a5fa';
    case 'needs_action': return '#f59e0b';
    case 'waiting':
    default:             return '#374151';
  }
}

function statusBg(status: StageStatus): string {
  switch (status) {
    case 'complete':     return 'rgba(74,222,128,0.10)';
    case 'in_progress':  return 'rgba(96,165,250,0.10)';
    case 'needs_action': return 'rgba(245,158,11,0.15)';
    case 'waiting':
    default:             return 'rgba(55,65,81,0.15)';
  }
}

function statusLabel(status: StageStatus): string {
  switch (status) {
    case 'complete':     return 'Complete';
    case 'in_progress':  return 'In Progress';
    case 'needs_action': return 'Needs Action';
    case 'waiting':
    default:             return 'Waiting';
  }
}

function severityColor(severity: Flag['severity']): string {
  switch (severity) {
    case 'critical': return '#f87171';
    case 'major':    return '#f59e0b';
    case 'minor':
    default:         return '#a3a3a3';
  }
}

function scoreColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.80) return '#4ade80';
  if (pct >= 0.60) return '#f59e0b';
  return '#f87171';
}

function recommendationBadge(rec: VanceStage['recommendation']): { label: string; color: string; bg: string } {
  switch (rec) {
    case 'approve': return { label: 'Approve',  color: '#4ade80', bg: 'rgba(74,222,128,0.12)' };
    case 'revise':  return { label: 'Revise',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    case 'reject':  return { label: 'Reject',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' };
    default:        return { label: 'Pending',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipelineBar({ pipeline, currentStage }: { pipeline: ClientState['pipeline']; currentStage: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '12px 0 4px' }}>
      {PIPELINE_STAGES.map((stage, i) => {
        const stageData = pipeline[stage.key] as { status: StageStatus };
        const isCurrent = currentStage === stage.key;
        const color = statusColor(stageData.status);
        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: i === 0 ? '6px 0 0 6px' : i === PIPELINE_STAGES.length - 1 ? '0 6px 6px 0' : 0,
              background: isCurrent ? `rgba(${stageData.status === 'in_progress' ? '96,165,250' : '245,158,11'},0.15)` : statusBg(stageData.status),
              border: `1px solid ${isCurrent ? color : 'rgba(255,255,255,0.06)'}`,
              borderLeft: i === 0 ? undefined : 'none',
              textAlign: 'center',
              transition: 'all 0.2s',
              position: 'relative',
            }}>
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: color,
                  boxShadow: `0 0 6px ${color}`,
                }} />
              )}
              <div style={{ fontSize: 10, marginBottom: 1 }}>{stage.emoji}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: isCurrent ? color : 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                {stage.label}
              </div>
              <div style={{ fontSize: 9, color: color, marginTop: 1 }}>
                {statusLabel(stageData.status)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VanceScoreBlock({ vance }: { vance: VanceStage }) {
  const [expanded, setExpanded] = useState(false);
  if (vance.status === 'waiting') return null;

  const rec = recommendationBadge(vance.recommendation);

  return (
    <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>🔬 Vance Review</span>
          {vance.score !== null && (
            <span style={{ fontSize: 14, fontWeight: 700, color: scoreColor(vance.score, vance.score_max) }}>
              {vance.score}<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>/{vance.score_max}</span>
            </span>
          )}
          {vance.recommendation && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: rec.bg, color: rec.color, fontWeight: 600 }}>
              {rec.label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {vance.flags.length > 0 && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 99,
              background: vance.flags.some(f => f.severity === 'critical') ? 'rgba(248,113,113,0.12)' :
                         vance.flags.some(f => f.severity === 'major')    ? 'rgba(245,158,11,0.12)' :
                                                                             'rgba(163,163,163,0.10)',
              color: vance.flags.some(f => f.severity === 'critical') ? '#f87171' :
                     vance.flags.some(f => f.severity === 'major')    ? '#f59e0b' : '#a3a3a3',
              fontWeight: 600,
            }}>
              ⚑ {vance.flags.length} flag{vance.flags.length !== 1 ? 's' : ''}
            </span>
          )}
          {(vance.section_scores || vance.flags.length > 0) && (
            <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 11, padding: '0 4px' }}>
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
          {vance.section_scores && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section Scores</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {Object.entries(vance.section_scores).map(([key, score]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: scoreColor(score, 10) }}>{score}/10</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {vance.flags.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Flags</div>
              {vance.flags.map((flag, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, color: severityColor(flag.severity), fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 1 }}>
                    {flag.severity}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>{flag.section.replace(/_/g, ' ')} — </span>
                    {flag.note}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Feature 5 — Blueprint Revision History
function VanceRevisionHistory({ history }: { history: VanceHistoryEntry[] }) {
  const [open, setOpen] = useState(false);
  if (!history || history.length <= 1) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 11, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        📋 {history.length} version{history.length !== 1 ? 's' : ''} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revision History</div>
          {history.map((entry, i) => {
            const rec = recommendationBadge(entry.recommendation);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, minWidth: 20 }}>v{i + 1}</span>
                {entry.score !== null && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(entry.score, entry.score_max || 80) }}>
                    {entry.score}/{entry.score_max || 80}
                  </span>
                )}
                {entry.recommendation && (
                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: rec.bg, color: rec.color, fontWeight: 600 }}>
                    {rec.label}
                  </span>
                )}
                {entry.completed_at && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
                    {new Date(entry.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionButtons({
  client,
  onApprove,
  onRevise,
  actionLoading,
}: {
  client: ClientState;
  onApprove: (id: string) => void;
  onRevise: (id: string, notes: string) => void;
  actionLoading: string | null;
}) {
  const [showReviseInput, setShowReviseInput] = useState(false);
  const [reviseNotes, setReviseNotes] = useState('');

  const canApprove = client.pipeline.vance.status === 'complete' &&
                     client.pipeline.approval.status !== 'complete' &&
                     client.pipeline.vance.recommendation === 'approve';
  const canOverrideApprove = client.pipeline.vance.status === 'complete' &&
                             client.pipeline.approval.status !== 'complete' &&
                             client.pipeline.vance.recommendation !== 'approve';
  const canRevise  = client.pipeline.vance.status === 'complete' &&
                     client.pipeline.approval.status !== 'complete';
  const hasBlueprintPdf    = !!client.pipeline.manus.files?.blueprint_pdf;
  const hasClientSummaryPdf = !!client.pipeline.client_summary.files?.summary_pdf;

  const loading = actionLoading === client.client.id;

  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {canApprove && !showReviseInput && (
        <button
          onClick={() => onApprove(client.client.id)}
          disabled={loading}
          style={{
            padding: '6px 14px', borderRadius: 7, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(74,222,128,0.2)' : '#4ade80', color: '#0a0a0a',
            fontWeight: 700, fontSize: 12, opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
          }}>
          {loading ? '...' : '✓ Approve Blueprint'}
        </button>
      )}

      {canOverrideApprove && !showReviseInput && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <button
            onClick={() => onApprove(client.client.id)}
            disabled={loading}
            style={{
              padding: '6px 14px', borderRadius: 7, border: '1px solid #F59E0B',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.18)', color: '#F59E0B',
              fontWeight: 700, fontSize: 12, opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
            }}>
            {loading ? '...' : '⚠️ Approve Anyway'}
          </button>
          <span style={{ fontSize: 10, color: 'rgba(245,158,11,0.7)', paddingLeft: 2 }}>Vance recommends revision</span>
        </div>
      )}

      {canRevise && !showReviseInput && (
        <button
          onClick={() => setShowReviseInput(true)}
          disabled={loading}
          style={{
            padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(245,158,11,0.4)', cursor: 'pointer',
            background: 'rgba(245,158,11,0.08)', color: '#f59e0b',
            fontWeight: 600, fontSize: 12, transition: 'all 0.15s',
          }}>
          ↩ Request Revision
        </button>
      )}

      {showReviseInput && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <input
            value={reviseNotes}
            onChange={e => setReviseNotes(e.target.value)}
            placeholder="Revision notes for Vance..."
            autoFocus
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 7, padding: '7px 10px', color: 'white', fontSize: 12,
              outline: 'none', width: '100%', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { onRevise(client.client.id, reviseNotes); setShowReviseInput(false); setReviseNotes(''); }}
              disabled={loading}
              style={{
                padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: '#f59e0b', color: '#0a0a0a', fontWeight: 700, fontSize: 12,
              }}>
              Send
            </button>
            <button
              onClick={() => { setShowReviseInput(false); setReviseNotes(''); }}
              style={{
                padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 12,
              }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {hasBlueprintPdf && (
        <a
          href={`${getBackendUrl()}/pho/clients/${client.client.id}/download/blueprint`}
          target="_blank" rel="noopener noreferrer"
          style={{
            padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(96,165,250,0.3)',
            background: 'rgba(96,165,250,0.08)', color: '#60a5fa',
            fontWeight: 600, fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
          ↓ Blueprint PDF
        </a>
      )}

      {hasClientSummaryPdf && (
        <a
          href={`${getBackendUrl()}/pho/clients/${client.client.id}/download/summary`}
          target="_blank" rel="noopener noreferrer"
          style={{
            padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(167,139,250,0.3)',
            background: 'rgba(167,139,250,0.08)', color: '#a78bfa',
            fontWeight: 600, fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
          ↓ Client Summary
        </a>
      )}
    </div>
  );
}

function ClientCard({
  client,
  onApprove,
  onRevise,
  actionLoading,
}: {
  client: ClientState;
  onApprove: (id: string) => void;
  onRevise: (id: string, notes: string) => void;
  actionLoading: string | null;
}) {
  const approvalStatus = client.pipeline.approval.status;
  // Derive badge color from the current active stage's status, not always approval
  const currentStageStatus = (
    client.pipeline[client.current_stage as keyof typeof client.pipeline] as { status: StageStatus } | undefined
  )?.status ?? 'waiting';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${approvalStatus === 'needs_action' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 12,
      padding: '16px 18px',
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 2 }}>
            {client.client.show_name !== 'TBD' ? client.client.show_name : client.client.name}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{client.client.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 10, padding: '3px 9px', borderRadius: 99, fontWeight: 600,
            background: statusBg(currentStageStatus),
            color: statusColor(currentStageStatus),
            border: `1px solid ${statusColor(currentStageStatus)}22`,
          }}>
            {client.current_stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
            {new Date(client.client.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Pipeline bar */}
      <PipelineBar pipeline={client.pipeline} currentStage={client.current_stage} />

      {/* Vance score + flags */}
      <VanceScoreBlock vance={client.pipeline.vance} />

      {/* Feature 5 — Revision history */}
      {client.vance_history && client.vance_history.length > 1 && (
        <VanceRevisionHistory history={client.vance_history} />
      )}

      {/* Revision notes if present */}
      {client.pipeline.approval.revision_notes && (
        <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>Revision: </span>
          {client.pipeline.approval.revision_notes}
        </div>
      )}

      {/* Action buttons */}
      <ActionButtons client={client} onApprove={onApprove} onRevise={onRevise} actionLoading={actionLoading} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const [clients, setClients] = useState<ClientState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState(getBackendUrl());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [archiving, setArchiving] = useState(false);
  const [archiveToast, setArchiveToast] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/pho/clients`, { headers: NGROK_HEADERS });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setClients(data.clients || []);
      setError(null);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message || 'Failed to connect to control server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
    const interval = setInterval(fetchClients, 30_000);
    return () => clearInterval(interval);
  }, [fetchClients]);

  // Issue #28: auto-dismiss actionError after 5 seconds
  const setActionErrorWithTimeout = useCallback((msg: string | null) => {
    setActionError(msg);
    if (msg) {
      setTimeout(() => setActionError(null), 5000);
    }
  }, []);

  const handleApprove = useCallback(async (id: string) => {
    setActionLoading(id);
    setActionError(null);
    try {
      const res = await fetch(`${getBackendUrl()}/pho/clients/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...NGROK_HEADERS },
        body: JSON.stringify({ approved_by: 'Sir' }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      await fetchClients();
    } catch (e: any) {
      setActionErrorWithTimeout(e.message || 'Approve failed');
    } finally {
      setActionLoading(null);
    }
  }, [fetchClients, setActionErrorWithTimeout]);

  const handleRevise = useCallback(async (id: string, notes: string) => {
    setActionLoading(id);
    setActionError(null);
    try {
      const res = await fetch(`${getBackendUrl()}/pho/clients/${id}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...NGROK_HEADERS },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      await fetchClients();
    } catch (e: any) {
      setActionErrorWithTimeout(e.message || 'Revision request failed');
    } finally {
      setActionLoading(null);
    }
  }, [fetchClients, setActionErrorWithTimeout]);

  const handleArchiveLegacy = useCallback(async () => {
    setArchiving(true);
    setArchiveToast(null);
    try {
      const res = await fetch(`${getBackendUrl()}/pho/clients/archive-legacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...NGROK_HEADERS },
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const count = data.archived?.length ?? 0;
      setArchiveToast(count === 0 ? 'No legacy folders found.' : `Archived ${count} legacy folder${count !== 1 ? 's' : ''}.`);
      setTimeout(() => setArchiveToast(null), 5000);
      await fetchClients();
    } catch (e: any) {
      setArchiveToast(`Archive failed: ${e.message}`);
      setTimeout(() => setArchiveToast(null), 5000);
    } finally {
      setArchiving(false);
    }
  }, [fetchClients]);

  // Feature 9 — Active/Archive tab split
  const isFullyComplete = (c: ClientState) =>
    c.pipeline.cipher?.status === 'complete' &&
    c.pipeline.manus?.status === 'complete' &&
    c.pipeline.vance?.status === 'complete' &&
    c.pipeline.approval?.status === 'complete' &&
    c.pipeline.client_summary?.status === 'complete';

  const activeClients = clients.filter(c => !isFullyComplete(c));
  const archivedClients = clients.filter(c => isFullyComplete(c));

  const needsAction = activeClients.filter(c =>
    c.pipeline.approval.status === 'needs_action' ||
    (c.pipeline.vance.recommendation === 'approve' && c.pipeline.approval.status !== 'complete')
  );
  const needsActionIds = new Set(needsAction.map(c => c.client.id));
  const inProgress  = activeClients.filter(c =>
    ['cipher', 'manus', 'vance', 'approval', 'client_summary'].includes(c.current_stage) &&
    !needsActionIds.has(c.client.id)
  );

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', color: 'white', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Nav bar ── */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: '#F59E0B', fontSize: 16 }}>⬡</span>
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.05em' }}>JARVIS HQ</span>
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>›</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>PHO Pipeline</span>
          {clients.length > 0 && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              {clients.length} project{clients.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {needsAction.length > 0 && (
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              {needsAction.length} need{needsAction.length !== 1 ? '' : 's'} action
            </span>
          )}
          {lastRefresh && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
              Refreshed {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {/* Feature 3 — Archive Legacy button */}
          <button
            onClick={handleArchiveLegacy}
            disabled={archiving}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', borderRadius: 7, padding: '5px 10px', cursor: archiving ? 'not-allowed' : 'pointer', fontSize: 11, opacity: archiving ? 0.6 : 1 }}>
            {archiving ? '...' : '🗄 Archive Legacy'}
          </button>
          <button
            onClick={fetchClients}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 11 }}>
            ↻ Refresh
          </button>
          <button
            onClick={() => setShowSettings(s => !s)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
            ⚙ Settings
          </button>
        </div>
      </div>

      {/* Feature 9 — Active / Archive tab nav */}
      <div style={{ padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 0, flexShrink: 0 }}>
        {(['active', 'archive'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', fontSize: 13, fontWeight: 600,
              color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.3)',
              borderBottom: activeTab === tab ? '2px solid #F59E0B' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            {tab === 'active' ? `Active ${activeClients.length > 0 ? `(${activeClients.length})` : ''}` : `Archive ${archivedClients.length > 0 ? `(${archivedClients.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── Settings dropdown ── */}
      {showSettings && (
        <div style={{ position: 'absolute', top: 52, right: 16, zIndex: 999, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, width: 300, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 8 }}>Backend URL</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://xxxx.ngrok-free.app"
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '7px 10px', color: 'white', fontSize: 12, outline: 'none' }}
            />
            <button
              onClick={() => { setBackendUrl(urlInput); setShowSettings(false); }}
              style={{ background: '#F59E0B', border: 'none', borderRadius: 8, padding: '7px 12px', color: 'black', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Save
            </button>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 8 }}>Current: {getBackendUrl()}</div>
        </div>
      )}

      {/* ── Action error toast ── */}
      {actionError && (
        <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 999, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 10 }}>
          ⚠ {actionError}
          <button onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Feature 3 — Archive toast */}
      {archiveToast && (
        <div style={{ position: 'absolute', bottom: actionError ? 60 : 20, right: 20, zIndex: 999, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 10 }}>
          🗄 {archiveToast}
          <button onClick={() => setArchiveToast(null)} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
            <div style={{ fontSize: 36 }}>🔬</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading PHO pipeline...</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
            <div style={{ fontSize: 36 }}>⚠️</div>
            <div style={{ color: '#f87171', fontSize: 14 }}>{error}</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Check that the control server is running and the backend URL is correct.</div>
            <button onClick={fetchClients} style={{ marginTop: 8, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', fontSize: 12 }}>
              Retry
            </button>
          </div>
        )}

        {/* Feature 9 — Archive tab */}
        {!loading && !error && activeTab === 'archive' && (
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            {archivedClients.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '40vh', gap: 12 }}>
                <div style={{ fontSize: 36 }}>🗄</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No completed projects yet</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Completed Projects
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {archivedClients.map(c => {
                    const vance = c.pipeline.vance;
                    const vanceScore = vance.score !== null ? `${vance.score}/${vance.score_max || 80}` : null;
                    const approvedAt = c.pipeline.approval.approved_at;
                    return (
                      <div key={c.client.id} style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.12)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                            {c.client.show_name !== 'TBD' ? c.client.show_name : c.client.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{c.client.name}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          {vanceScore && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Vance Score</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: scoreColor(vance.score!, vance.score_max || 80) }}>{vanceScore}</div>
                            </div>
                          )}
                          {approvedAt && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Completed</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                                {new Date(approvedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                          )}
                          <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 99, background: 'rgba(74,222,128,0.12)', color: '#4ade80', fontWeight: 600 }}>
                            ✓ Complete
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feature 9 — Active tab (existing content) */}
        {!loading && !error && activeTab === 'active' && (
          <>
            {activeClients.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
                <div style={{ fontSize: 36 }}>📭</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No active projects</div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                  Projects appear here once Cipher creates a <code style={{ color: 'rgba(255,255,255,0.35)' }}>state.json</code> in the client folder.
                </div>
              </div>
            )}

            {activeClients.length > 0 && (
              <div style={{ maxWidth: 860, margin: '0 auto' }}>

                {/* Needs action section */}
                {needsAction.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', boxShadow: '0 0 6px #f59e0b' }} />
                      Needs Your Attention
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {needsAction.map(c => (
                        <ClientCard key={c.client.id} client={c} onApprove={handleApprove} onRevise={handleRevise} actionLoading={actionLoading} />
                      ))}
                    </div>
                  </div>
                )}

                {/* In progress section */}
                {inProgress.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
                      In Progress
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {inProgress.map(c => (
                        <ClientCard key={c.client.id} client={c} onApprove={handleApprove} onRevise={handleRevise} actionLoading={actionLoading} />
                      ))}
                    </div>
                  </div>
                )}

                {/* All other projects */}
                {(() => {
                  const needsIds = new Set(needsAction.map(c => c.client.id));
                  const inProgIds = new Set(inProgress.map(c => c.client.id));
                  const rest = activeClients.filter(c => !needsIds.has(c.client.id) && !inProgIds.has(c.client.id));
                  if (rest.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                        All Projects
                      </div>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {rest.map(c => (
                          <ClientCard key={c.client.id} client={c} onApprove={handleApprove} onRevise={handleRevise} actionLoading={actionLoading} />
                        ))}
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
