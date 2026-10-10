import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// iOS home-screen icon, rendered from the same artwork as app/icon.svg.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const svg = await readFile(join(process.cwd(), "app/icon.svg"), "base64");

export default function AppleIcon() {
  return new ImageResponse(
    (
      // Paper background fills the tile's rounded corners; iOS applies its own mask.
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f4f0e7" }}>
        <img src={`data:image/svg+xml;base64,${svg}`} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
