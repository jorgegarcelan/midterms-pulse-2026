// Map-builder picks in the URL: one trit per race (0 undecided, 1 D, 2 R), five trits per byte, base64url.
export type Pick = "D" | "R";
export type Picks = Record<string, Pick>;

const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (text: string) => {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

export function encodePicks(codes: string[], picks: Picks) {
  const bytes = new Uint8Array(Math.ceil(codes.length / 5));
  codes.forEach((code, index) => {
    const trit = picks[code] === "D" ? 1 : picks[code] === "R" ? 2 : 0;
    bytes[Math.floor(index / 5)] += trit * 3 ** (index % 5);
  });
  return toBase64Url(bytes);
}

export function decodePicks(codes: string[], text: string | undefined): Picks | null {
  if (!text) return null;
  try {
    const bytes = fromBase64Url(text);
    if (bytes.length !== Math.ceil(codes.length / 5)) return null;
    const picks: Picks = {};
    codes.forEach((code, index) => {
      const trit = Math.floor(bytes[Math.floor(index / 5)] / 3 ** (index % 5)) % 3;
      if (trit === 1) picks[code] = "D";
      else if (trit === 2) picks[code] = "R";
    });
    return picks;
  } catch {
    return null;
  }
}
