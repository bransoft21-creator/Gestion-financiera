import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const meridianIcon = readFileSync(join(process.cwd(), "public/icons/Meridian.png")).toString("base64");

// Generates the browser favicon from the same icon used in login/header.
export default function Icon() {
  return new ImageResponse(
    (
      <img
        alt="Meridian"
        src={`data:image/png;base64,${meridianIcon}`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    ),
    { ...size },
  );
}
