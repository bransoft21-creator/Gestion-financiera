import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Meridian — Tu dinero, con perspectiva.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#03070D",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient teal glow — top right */}
        <div
          style={{
            position: "absolute",
            top: 80,
            right: 140,
            width: 2,
            height: 2,
            borderRadius: "50%",
            boxShadow: "0 0 320px 280px rgba(20,184,166,0.09)",
          }}
        />
        {/* Ambient teal glow — bottom left */}
        <div
          style={{
            position: "absolute",
            bottom: 100,
            left: 120,
            width: 2,
            height: 2,
            borderRadius: "50%",
            boxShadow: "0 0 220px 180px rgba(20,184,166,0.05)",
          }}
        />

        {/* Meridian mark */}
        <svg width="160" height="160" viewBox="0 0 36 36" fill="none">
          {/* Glow halo */}
          <circle cx="18" cy="18" r="6" fill="#14B8A6" opacity="0.18" />
          {/* Top line */}
          <path
            d="M7 13 L29 13"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* Bottom line */}
          <path
            d="M7 23 L29 23"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* Teal node */}
          <circle cx="18" cy="18" r="2.5" fill="#14B8A6" />
        </svg>

        {/* Wordmark */}
        <div
          style={{
            marginTop: 20,
            fontSize: 72,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "-2.5px",
            lineHeight: 1,
          }}
        >
          meridian
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 16,
            fontSize: 22,
            fontWeight: 400,
            color: "rgba(161,161,170,0.7)",
            letterSpacing: "-0.2px",
          }}
        >
          Tu dinero, con perspectiva.
        </div>

        {/* Teal accent rule */}
        <div
          style={{
            marginTop: 32,
            width: 40,
            height: 2,
            background: "rgba(20,184,166,0.5)",
            borderRadius: "1px",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
