import assert from "node:assert/strict";
import test from "node:test";
import { createZip, type ZipSourceFile } from "./zip.js";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

// Independent of zip.ts's own crcTable/crc32 implementation on purpose, so this test
// isn't tautological — a bit-by-bit CRC32 instead of zip.ts's table-driven one.
function independentCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

type ParsedEntry = {
  filename: string;
  content: string;
  crc32: number;
};

// A minimal from-scratch PKZIP reader used only to verify createZip's byte layout.
function parseZip(archive: Uint8Array): ParsedEntry[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

  const eocdOffset = archive.byteLength - 22;
  assert.equal(
    view.getUint32(eocdOffset, true),
    0x06054b50,
    "missing end-of-central-directory signature"
  );

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  const entries: ParsedEntry[] = [];
  let cdCursor = centralDirectoryOffset;

  for (let i = 0; i < entryCount; i += 1) {
    assert.equal(
      view.getUint32(cdCursor, true),
      0x02014b50,
      `entry ${i}: missing central directory signature`
    );

    const crc32 = view.getUint32(cdCursor + 16, true);
    const compressedSize = view.getUint32(cdCursor + 20, true);
    const filenameLength = view.getUint16(cdCursor + 28, true);
    const extraLength = view.getUint16(cdCursor + 30, true);
    const commentLength = view.getUint16(cdCursor + 32, true);
    const localHeaderOffset = view.getUint32(cdCursor + 42, true);
    const filename = decoder.decode(archive.subarray(cdCursor + 46, cdCursor + 46 + filenameLength));

    assert.equal(
      view.getUint32(localHeaderOffset, true),
      0x04034b50,
      `entry ${i}: missing local file header signature`
    );
    const localFilenameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const contentStart = localHeaderOffset + 30 + localFilenameLength + localExtraLength;
    const content = decoder.decode(archive.subarray(contentStart, contentStart + compressedSize));

    entries.push({ filename, content, crc32 });
    cdCursor += 46 + filenameLength + extraLength + commentLength;
  }

  return entries;
}

test("round-trips a single ascii file through the archive structure", () => {
  const files: ZipSourceFile[] = [{ path: "hello.txt", content: "hello world" }];
  const entries = parseZip(createZip(files, new Date("2026-01-15T10:30:00Z")));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].filename, "hello.txt");
  assert.equal(entries[0].content, "hello world");
  assert.equal(entries[0].crc32, independentCrc32(encoder.encode("hello world")));
});

test("round-trips multiple files with correct independent offsets", () => {
  const files: ZipSourceFile[] = [
    { path: "dir/a.txt", content: "content of a" },
    { path: "dir/b.txt", content: "a much longer content string for file b to shift offsets" },
    { path: "c.json", content: JSON.stringify({ ok: true, values: [1, 2, 3] }) }
  ];
  const entries = parseZip(createZip(files, new Date("2026-01-15T10:30:00Z")));

  assert.equal(entries.length, files.length);
  for (const [i, file] of files.entries()) {
    assert.equal(entries[i].filename, file.path);
    assert.equal(entries[i].content, file.content);
    assert.equal(entries[i].crc32, independentCrc32(encoder.encode(file.content)));
  }
});

test("round-trips a non-ascii filename and content", () => {
  const files: ZipSourceFile[] = [{ path: "agent-bundle/설정.md", content: "안녕하세요 🎉" }];
  const entries = parseZip(createZip(files, new Date("2026-01-15T10:30:00Z")));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].filename, "agent-bundle/설정.md");
  assert.equal(entries[0].content, "안녕하세요 🎉");
  assert.equal(entries[0].crc32, independentCrc32(encoder.encode("안녕하세요 🎉")));
});

test("produces a valid, empty archive for an empty file list", () => {
  const archive = createZip([], new Date("2026-01-15T10:30:00Z"));

  assert.equal(archive.byteLength, 22);
  assert.deepEqual(parseZip(archive), []);
});
