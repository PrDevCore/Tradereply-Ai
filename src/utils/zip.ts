/** Minimal, dependency-free ZIP writer for a known set of UTF-8 text files. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function push16(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function push32(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

/** Create a standard uncompressed ZIP archive without adding a runtime dependency. */
export function createExtensionZip(files: Readonly<Record<string, string>>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const [fileName, content] of Object.entries(files)) {
    const name = encoder.encode(fileName);
    const data = encoder.encode(content);
    const checksum = crc32(data);
    const local: number[] = [];
    push32(local, 0x04034b50);
    push16(local, 20);
    push16(local, 0x0800); // UTF-8 filenames
    push16(local, 0);       // stored
    push16(local, 0); push16(local, 0); // deterministic timestamp
    push32(local, checksum);
    push32(local, data.length);
    push32(local, data.length);
    push16(local, name.length);
    push16(local, 0);
    localParts.push(new Uint8Array(local), name, data);

    const central: number[] = [];
    push32(central, 0x02014b50);
    push16(central, 20); push16(central, 20);
    push16(central, 0x0800); push16(central, 0);
    push16(central, 0); push16(central, 0);
    push32(central, checksum);
    push32(central, data.length); push32(central, data.length);
    push16(central, name.length); push16(central, 0); push16(central, 0);
    push16(central, 0); push16(central, 0); push32(central, 0);
    push32(central, offset);
    centralParts.push(new Uint8Array(central), name);
    offset += local.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end: number[] = [];
  push32(end, 0x06054b50);
  push16(end, 0); push16(end, 0);
  push16(end, Object.keys(files).length); push16(end, Object.keys(files).length);
  push32(end, centralSize); push32(end, offset); push16(end, 0);

  const size = localParts.reduce((sum, part) => sum + part.length, 0) + centralSize + end.length;
  const result = new Uint8Array(size) as Uint8Array<ArrayBuffer>;
  let position = 0;
  for (const part of [...localParts, ...centralParts, new Uint8Array(end)]) {
    result.set(part, position);
    position += part.length;
  }
  return result;
}
