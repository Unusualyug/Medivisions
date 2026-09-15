const KNOWN_SIGNATURES = [
  Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"),
];

export function scanUploadBuffer(buffer: Buffer) {
  for (const signature of KNOWN_SIGNATURES) {
    if (buffer.includes(signature)) return { safe: false, reason: "Known malware test signature detected" };
  }
  if (buffer.includes(Buffer.from("<script", "utf8"))) return { safe: false, reason: "Script content detected in binary upload" };
  return { safe: true as const };
}
