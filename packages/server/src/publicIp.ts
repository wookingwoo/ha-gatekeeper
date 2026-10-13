import { isIP } from "node:net";

function normalizeIp(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  // Socket scope identifiers describe the interface, not a distinct IP budget.
  const address = ip.split("%", 1)[0];
  // URL canonicalization handles compressed, expanded, and dotted mapped forms.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(canonical);
  if (!mapped) return canonical;
  const high = parseInt(mapped[1], 16);
  const low = parseInt(mapped[2], 16);
  return `${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`;
}

// Forwarded identity is trusted only on the dedicated tunnel's loopback socket.
export function resolvePublicIp(peer: string, header: string | string[] | undefined, tunnel: boolean): string {
  const normalizedPeer = normalizeIp(peer);
  if (tunnel && (normalizedPeer === "127.0.0.1" || normalizedPeer === "::1") &&
      typeof header === "string" && !header.includes("%") && isIP(header)) {
    return normalizeIp(header);
  }
  return normalizedPeer;
}
