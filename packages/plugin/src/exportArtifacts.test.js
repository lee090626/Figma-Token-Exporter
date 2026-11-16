import { expect, it } from "vitest";
import { createZip } from "./exportArtifacts.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function readU16(bytes, offset) {
  return bytes[offset] | bytes[offset + 1] << 8;
}

function readU32(bytes, offset) {
  return (bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] << 24) >>> 0;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? crc >>> 1 ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function text(bytes, offset, length) {
  return decoder.decode(bytes.slice(offset, offset + length));
}

function expectZip(bytes, entries) {
  let localOffset = 0;
  const localOffsets = [];

  for (const [filename, content] of entries) {
    localOffsets.push(localOffset);
    expect(readU32(bytes, localOffset)).toBe(0x04034b50);
    expect(readU16(bytes, localOffset + 4)).toBe(20);
    expect(readU16(bytes, localOffset + 6)).toBe(0x0800);
    expect(readU16(bytes, localOffset + 8)).toBe(0);
    expect(readU16(bytes, localOffset + 10)).toBe(0);
    expect(readU16(bytes, localOffset + 12)).toBe(0);

    const nameLength = readU16(bytes, localOffset + 26);
    const extraLength = readU16(bytes, localOffset + 28);
    const dataOffset = localOffset + 30 + nameLength + extraLength;
    const data = encoder.encode(content);
    expect(nameLength).toBe(encoder.encode(filename).length);
    expect(extraLength).toBe(0);
    expect(text(bytes, localOffset + 30, nameLength)).toBe(filename);
    expect(readU32(bytes, localOffset + 14)).toBe(crc32(data));
    expect(readU32(bytes, localOffset + 18)).toBe(data.length);
    expect(readU32(bytes, localOffset + 22)).toBe(data.length);
    expect(Array.from(bytes.slice(dataOffset, dataOffset + data.length))).toEqual(Array.from(data));
    localOffset = dataOffset + data.length;
  }

  let centralOffset = localOffset;
  for (const [filename, content] of entries) {
    const data = encoder.encode(content);
    const nameLength = readU16(bytes, centralOffset + 28);
    expect(readU32(bytes, centralOffset)).toBe(0x02014b50);
    expect(readU16(bytes, centralOffset + 8)).toBe(0x0800);
    expect(readU16(bytes, centralOffset + 10)).toBe(0);
    expect(readU32(bytes, centralOffset + 16)).toBe(crc32(data));
    expect(readU32(bytes, centralOffset + 20)).toBe(data.length);
    expect(readU32(bytes, centralOffset + 24)).toBe(data.length);
    expect(text(bytes, centralOffset + 46, nameLength)).toBe(filename);
    expect(readU32(bytes, centralOffset + 42)).toBe(localOffsets.shift());
    centralOffset += 46 + nameLength + readU16(bytes, centralOffset + 30) + readU16(bytes, centralOffset + 32);
  }

  const eocdOffset = bytes.length - 22;
  expect(centralOffset).toBe(eocdOffset);
  expect(readU32(bytes, eocdOffset)).toBe(0x06054b50);
  expect(readU16(bytes, eocdOffset + 4)).toBe(0);
  expect(readU16(bytes, eocdOffset + 6)).toBe(0);
  expect(readU16(bytes, eocdOffset + 8)).toBe(entries.length);
  expect(readU16(bytes, eocdOffset + 10)).toBe(entries.length);
  expect(readU32(bytes, eocdOffset + 12)).toBe(centralOffset - localOffset);
  expect(readU32(bytes, eocdOffset + 16)).toBe(localOffset);
  expect(readU16(bytes, eocdOffset + 20)).toBe(0);
}

it("preserves six-file ZIP entries and empty-file ZIP structure", () => {
  const entries = [
    ["tokens.json", '{"color":{"primary":"#ff0000"}}'],
    ["theme.ts", 'export const theme = { color: { primary: "#ff0000" } };'],
    ["variables.css", ":root { --color-primary: #ff0000; }"],
    ["tokens.scss", "$color-primary: #ff0000;"],
    ["tailwind.css", "@theme { --color-primary: #ff0000; }"],
    ["tokens.dtcg.json", '{"color":{"primary":{"$value":"#ff0000"}}}']
  ];

  expectZip(createZip(entries), entries);
  expectZip(createZip(entries.map(([filename]) => [filename, ""])), entries.map(([filename]) => [filename, ""]));
});
