/**
 * A dependency-free, deterministic ZIP (and CRC-32) writer used to build the OOXML
 * fixtures at test time.
 *
 * Why hand-rolled rather than a library: `.docx` is a ZIP container, and committing a
 * binary blob would make the fixture unreviewable — a reviewer could not tell what the
 * document actually contains. Building the package from readable WordprocessingML in
 * {@link ../docx.fixture} keeps the fixture diffable, and the writer itself is small
 * enough (STORED entries only, no compression) that it adds no dependency to the plugin.
 *
 * Entries are written with method 0 (STORED) — every OOXML reader in the dependency tree
 * (JSZip via mammoth, ExcelJS) accepts uncompressed entries.
 */

/** Standard CRC-32 (IEEE 802.3) lookup table — shared by the ZIP and PNG fixtures. */
const CRC_TABLE: Int32Array = (() => {
	const table = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c;
	}
	return table;
})();

/**
 * Computes the CRC-32 of a buffer (the checksum both ZIP entries and PNG chunks use).
 *
 * @param buffer The bytes to checksum.
 * @returns The unsigned 32-bit CRC.
 */
export function crc32(buffer: Buffer): number {
	let crc = -1;
	for (let i = 0; i < buffer.length; i++) {
		crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ -1) >>> 0;
}

/** One file inside the generated archive. */
export interface IZipEntry {
	/** The in-archive path, e.g. `word/document.xml`. */
	name: string;
	/** The entry payload (a string is encoded as UTF-8). */
	data: string | Buffer;
}

/**
 * Builds a ZIP archive containing the given entries, all STORED (uncompressed).
 *
 * @param entries The archive members, in the order they should be written.
 * @returns The complete `.zip` bytes.
 */
export function createStoredZip(entries: IZipEntry[]): Buffer {
	const localParts: Buffer[] = [];
	const centralParts: Buffer[] = [];
	let offset = 0;

	for (const entry of entries) {
		const name = Buffer.from(entry.name, 'utf8');
		const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
		const crc = crc32(data);

		// Local file header (30 bytes + name).
		const local = Buffer.alloc(30 + name.length);
		local.writeUInt32LE(0x04034b50, 0); // signature
		local.writeUInt16LE(20, 4); // version needed
		local.writeUInt16LE(0, 6); // flags
		local.writeUInt16LE(0, 8); // method: STORED
		local.writeUInt16LE(0, 10); // mod time (fixed — fixtures must be byte-stable)
		local.writeUInt16LE(0x21, 12); // mod date (1980-01-01)
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(data.length, 18); // compressed size
		local.writeUInt32LE(data.length, 22); // uncompressed size
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28); // extra length
		name.copy(local, 30);
		localParts.push(local, data);

		// Central directory record (46 bytes + name).
		const central = Buffer.alloc(46 + name.length);
		central.writeUInt32LE(0x02014b50, 0); // signature
		central.writeUInt16LE(20, 4); // version made by
		central.writeUInt16LE(20, 6); // version needed
		central.writeUInt16LE(0, 8); // flags
		central.writeUInt16LE(0, 10); // method: STORED
		central.writeUInt16LE(0, 12);
		central.writeUInt16LE(0x21, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt16LE(0, 30); // extra
		central.writeUInt16LE(0, 32); // comment
		central.writeUInt16LE(0, 34); // disk number
		central.writeUInt16LE(0, 36); // internal attributes
		central.writeUInt32LE(0, 38); // external attributes
		central.writeUInt32LE(offset, 42); // local header offset
		name.copy(central, 46);
		centralParts.push(central);

		offset += local.length + data.length;
	}

	const centralDirectory = Buffer.concat(centralParts);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0); // EOCD signature
	end.writeUInt16LE(0, 4); // this disk
	end.writeUInt16LE(0, 6); // central directory disk
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(centralDirectory.length, 12);
	end.writeUInt32LE(offset, 16);
	end.writeUInt16LE(0, 20); // comment length

	return Buffer.concat([...localParts, centralDirectory, end]);
}
