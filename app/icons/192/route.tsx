import { ImageResponse } from "next/og";

export const runtime = "edge";

// Serves the Meridian PWA icon at 192×192.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#03070D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="6" fill="#14B8A6" opacity="0.18" />
          <path
            d="M7 13 L29 13"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <path
            d="M7 23 L29 23"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <circle cx="18" cy="18" r="2.5" fill="#14B8A6" />
        </svg>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
