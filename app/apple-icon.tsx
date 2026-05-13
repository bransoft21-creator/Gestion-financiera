import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Generates apple-touch-icon (180×180) via Next.js file-based metadata.
export default function AppleIcon() {
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
          borderRadius: "40px",
        }}
      >
        <svg width="108" height="108" viewBox="0 0 36 36" fill="none">
          {/* Glow */}
          <circle cx="18" cy="18" r="6" fill="#14B8A6" opacity="0.18" />
          {/* Lines */}
          <path d="M7 13 L29 13" stroke="white" strokeOpacity="0.25" strokeWidth="1" strokeLinecap="round" />
          <path d="M7 23 L29 23" stroke="white" strokeOpacity="0.25" strokeWidth="1" strokeLinecap="round" />
          {/* Node */}
          <circle cx="18" cy="18" r="2.5" fill="#14B8A6" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
