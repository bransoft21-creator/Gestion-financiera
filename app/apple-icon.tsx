import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const meridianIcon = readFileSync(join(process.cwd(), "public/icons/Meridian.png")).toString("base64");
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
