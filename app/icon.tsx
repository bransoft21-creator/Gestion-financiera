import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Generates /favicon.ico (32×32) via Next.js file-based metadata.
export default function Icon() {
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
          borderRadius: "7px",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
          {/* Glow */}
          <circle cx="18" cy="18" r="5" fill="#14B8A6" opacity="0.2" />
          {/* Lines */}
          <path d="M7 13 L29 13" stroke="white" strokeOpacity="0.28" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M7 23 L29 23" stroke="white" strokeOpacity="0.28" strokeWidth="1.2" strokeLinecap="round" />
          {/* Node */}
          <circle cx="18" cy="18" r="2.8" fill="#14B8A6" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
