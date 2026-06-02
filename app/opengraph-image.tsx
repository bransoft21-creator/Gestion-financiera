import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const alt = "Meridian — Tu dinero, con perspectiva.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const icon = readFileSync(join(process.cwd(), "public/icons/icon-512.png")).toString("base64");

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

        {/* App icon */}
        <img
          alt="Meridian"
          src={`data:image/png;base64,${icon}`}
          style={{ width: 144, height: 144, objectFit: "contain" }}
        />

        {/* Wordmark */}
        <div
          style={{
            marginTop: 24,
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
