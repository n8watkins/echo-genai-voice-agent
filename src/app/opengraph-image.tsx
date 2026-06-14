import { ImageResponse } from 'next/og';

export const alt = 'Echo — Realtime Voice Agent';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 1200x630 branded share card on the app's dark stage (#06070d) with a
// subtle cyan/teal radial glow, matching the in-app brand mark.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 90px',
          // dark stage bg + cyan/teal radial glow (matches .echo-stage)
          background:
            'radial-gradient(1200px 800px at 50% 30%, rgba(6, 182, 212, 0.18), transparent 60%), radial-gradient(900px 700px at 80% 80%, rgba(20, 184, 166, 0.14), transparent 60%), #06070d',
          color: '#e2e8f0',
          fontFamily: 'sans-serif',
        }}
      >
        {/* brand mark: gradient rounded square + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 84,
              height: 84,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #06b6d4 0%, #14b8a6 100%)',
              color: '#ffffff',
              fontSize: 60,
              fontWeight: 800,
            }}
          >
            E
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              // cyan-400 → teal-300, matching the in-app wordmark
              background: 'linear-gradient(90deg, #22d3ee 0%, #5eead4 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Echo
          </div>
        </div>

        {/* subtitle */}
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 44,
            fontWeight: 600,
            color: '#a5f3fc',
          }}
        >
          Realtime Voice Agent
        </div>

        {/* tagline */}
        <div
          style={{
            display: 'flex',
            marginTop: 20,
            fontSize: 30,
            fontWeight: 400,
            color: '#94a3b8',
            maxWidth: 980,
          }}
        >
          Talk to an AI that talks back — streamed, interruptible, real-time.
        </div>

        {/* portfolio mark */}
        <div
          style={{
            display: 'flex',
            marginTop: 56,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#475569',
          }}
        >
          Portfolio project
        </div>
      </div>
    ),
    { ...size }
  );
}
