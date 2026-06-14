import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// 32x32 favicon: cyan→teal gradient rounded square with a bold white "E",
// matching the app's brand mark (from-cyan-400 to-teal-300).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          // cyan-400 → teal-300
          background: 'linear-gradient(135deg, #06b6d4 0%, #14b8a6 100%)',
          color: '#ffffff',
          fontSize: 24,
          fontWeight: 800,
          fontFamily: 'sans-serif',
        }}
      >
        E
      </div>
    ),
    { ...size }
  );
}
