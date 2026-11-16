const utf8Flag = 0x0800;
const textEncoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

export function createZip(entries) {
  const localFiles = [];
  const centralDirectory = [];
  let offset = 0;
  for (const [filename, content] of entries) {
    const name = textEncoder.encode(filename);
    const data = textEncoder.encode(content);
    const crc = crc32(data);
    const local = joinBytes([u32(0x04034b50), u16(20), u16(utf8Flag), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    localFiles.push(local);
    centralDirectory.push(joinBytes([u32(0x02014b50), u16(20), u16(20), u16(utf8Flag), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += local.length;
  }
  const central = joinBytes(centralDirectory);
  return joinBytes([...localFiles, central, u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0)]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  return new Uint8Array([value & 0xff, value >>> 8 & 0xff]);
}

function u32(value) {
  return new Uint8Array([value & 0xff, value >>> 8 & 0xff, value >>> 16 & 0xff, value >>> 24 & 0xff]);
}

function joinBytes(parts) {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
