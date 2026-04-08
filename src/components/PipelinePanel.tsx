import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  onAgentWorkingChange: (agentStatuses: Record<string, 'working' | 'idle'>) => void;
  onPipelineActiveChange: (active: boolean) => void;
  pipelineActive: boolean;
}

/**
 * PipelinePanel — HQ top-bar shortcut to the PHO Pipeline page.
 *
 * The old Architecture A pipeline (Eren/Mikasa/Baelor/Vega/Nova/Atlas/Rex) has been
 * removed. Pipeline management is handled entirely by Cipher → Manus → Vance.
 * Use the "📊 PHO Pipeline" button or click the link below to manage pipelines.
 */
export function PipelinePanel({ onAgentWorkingChange, onPipelineActiveChange, pipelineActive }: Props) {
  const navigate = useNavigate();

  const handleGoToPipeline = useCallback(() => {
    navigate('/pipeline');
  }, [navigate]);

  return (
    <>
      <button
        onClick={handleGoToPipeline}
        style={{
          background: pipelineActive ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${pipelineActive ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.08)'}`,
          color: pipelineActive ? '#22d3ee' : 'rgba(255,255,255,0.4)',
          borderRadius: 8,
          padding: '5px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.02em',
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
        📊 PHO Pipeline
      </button>

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
