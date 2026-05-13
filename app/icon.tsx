import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Generates the browser favicon (32×32) via Next.js file-based metadata.
// Dark background + mark at 24px gives maximum clarity at small sizes.
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
        }}
      >
        <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
          {/* Glow — larger radius for visibility at small render size */}
          <circle cx="18" cy="18" r="5" fill="#14B8A6" opacity="0.3" />
          {/* Lines — slightly heavier stroke for 32px legibility */}
          <path
            d="M7 13 L29 13"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M7 23 L29 23"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Node — slightly larger for visibility */}
          <circle cx="18" cy="18" r="3" fill="#14B8A6" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
