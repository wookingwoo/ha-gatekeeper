export type ZipSourceFile = { path: string; content: string };

type EncodedFile = {
  pathBytes: Uint8Array;
  contentBytes: Uint8Array;
  crc32: number;
  offset: number;
};

const encoder = new TextEncoder();
const crcTable = createCrcTable();

export function createZip(files: ZipSourceFile[], modifiedAt = new Date()): Uint8Array {
  const encodedFiles: EncodedFile[] = files.map((file) => {
    const pathBytes = encoder.encode(file.path);
    const contentBytes = encoder.encode(file.content);

    if (pathBytes.length > 0xffff) {
      throw new Error(`zip_path_too_long:${file.path}`);
    }

    return {
      pathBytes,
      contentBytes,
      crc32: crc32(contentBytes),
      offset: 0
    };
  });

  const { dosTime, dosDate } = toDosDateTime(modifiedAt);
  let localSize = 0;
  for (const file of encodedFiles) {
    file.offset = localSize;
    localSize += 30 + file.pathBytes.length + file.contentBytes.length;
  }

  const centralDirectorySize = encodedFiles.reduce(
    (total, file) => total + 46 + file.pathBytes.length,
    0
  );
  const archive = new Uint8Array(localSize + centralDirectorySize + 22);
  const view = new DataView(archive.buffer);
  let offset = 0;

  for (const file of encodedFiles) {
    offset = writeLocalFileHeader(archive, view, offset, file, dosTime, dosDate);
  }

  const centralDirectoryOffset = offset;
  for (const file of encodedFiles) {
    offset = writeCentralDirectoryHeader(archive, view, offset, file, dosTime, dosDate);
  }
  const centralDirectoryEnd = offset;

  view.setUint32(offset, 0x06054b50, true);
  offset += 4;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint16(offset, encodedFiles.length, true);
  offset += 2;
  view.setUint16(offset, encodedFiles.length, true);
  offset += 2;
  view.setUint32(offset, centralDirectoryEnd - centralDirectoryOffset, true);
  offset += 4;
  view.setUint32(offset, centralDirectoryOffset, true);
  offset += 4;
  view.setUint16(offset, 0, true);

  return archive;
}

function writeLocalFileHeader(
  archive: Uint8Array,
  view: DataView,
  offset: number,
  file: EncodedFile,
  dosTime: number,
  dosDate: number
): number {
  view.setUint32(offset, 0x04034b50, true);
  offset += 4;
  view.setUint16(offset, 20, true);
  offset += 2;
  view.setUint16(offset, 0x0800, true);
  offset += 2;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint16(offset, dosTime, true);
  offset += 2;
  view.setUint16(offset, dosDate, true);
  offset += 2;
  view.setUint32(offset, file.crc32, true);
  offset += 4;
  view.setUint32(offset, file.contentBytes.length, true);
  offset += 4;
  view.setUint32(offset, file.contentBytes.length, true);
  offset += 4;
  view.setUint16(offset, file.pathBytes.length, true);
  offset += 2;
  view.setUint16(offset, 0, true);
  offset += 2;
  archive.set(file.pathBytes, offset);
  offset += file.pathBytes.length;
  archive.set(file.contentBytes, offset);
  return offset + file.contentBytes.length;
}

function writeCentralDirectoryHeader(
  archive: Uint8Array,
  view: DataView,
  offset: number,
  file: EncodedFile,
  dosTime: number,
  dosDate: number
): number {
  view.setUint32(offset, 0x02014b50, true);
  offset += 4;
  view.setUint16(offset, 20, true);
  offset += 2;
  view.setUint16(offset, 20, true);
  offset += 2;
  view.setUint16(offset, 0x0800, true);
  offset += 2;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint16(offset, dosTime, true);
  offset += 2;
  view.setUint16(offset, dosDate, true);
  offset += 2;
  view.setUint32(offset, file.crc32, true);
  offset += 4;
  view.setUint32(offset, file.contentBytes.length, true);
  offset += 4;
  view.setUint32(offset, file.contentBytes.length, true);
  offset += 4;
  view.setUint16(offset, file.pathBytes.length, true);
  offset += 2;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint16(offset, 0, true);
  offset += 2;
  view.setUint32(offset, 0, true);
  offset += 4;
  view.setUint32(offset, file.offset, true);
  offset += 4;
  archive.set(file.pathBytes, offset);
  return offset + file.pathBytes.length;
}

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let bit = 0; bit < 8; bit += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    dosTime: (hours << 11) | (minutes << 5) | seconds,
    dosDate: ((year - 1980) << 9) | (month << 5) | day
  };
}
