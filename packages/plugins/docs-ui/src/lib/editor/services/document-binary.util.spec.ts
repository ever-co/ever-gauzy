import { Schema } from '@tiptap/pm/model';
import { ICrdtEncoder, encodeContentBinary, toBase64 } from './document-binary.util';

/**
 * `contentBinary` payload (spec 05 §9.1 storage table / §11 collaboration readiness).
 *
 * 🛑 The gap this closes: the column, the entity field and the `yjs` / `@tiptap/y-tiptap`
 * dependencies had all shipped, but **no save path ever wrote one**. The encoder itself is
 * upstream's; what is worth pinning here is that a reserved, forward-looking field can never
 * take a content save down with it — an unloaded chunk, an oversized document or a schema the
 * JSON does not parse against must all degrade to "no binary", not to a failed save.
 *
 * `loadCrdtEncoder()` is deliberately NOT exercised: it exists to keep `yjs` out of the
 * 260 KB tier-2 chunk (§12), and asserting on a dynamic import would only test the bundler.
 */
describe('encodeContentBinary', () => {
	const schema = {} as Schema;
	const json = { type: 'doc', content: [] };

	const encoderOf = (bytes: Uint8Array): ICrdtEncoder => ({ encode: jest.fn(() => bytes) });

	it('base64-encodes the update the encoder produced', () => {
		expect(encodeContentBinary(encoderOf(new Uint8Array([1, 2, 3])), schema, json)).toBe(
			toBase64(new Uint8Array([1, 2, 3]))
		);
	});

	it('skips the field while the encoder chunk is still loading', () => {
		expect(encodeContentBinary(null, schema, json)).toBeNull();
	});

	it('skips the field when there is no schema or no content yet', () => {
		const encoder = encoderOf(new Uint8Array([1]));
		expect(encodeContentBinary(encoder, null, json)).toBeNull();
		expect(encodeContentBinary(encoder, schema, null)).toBeNull();
		expect(encoder.encode).not.toHaveBeenCalled();
	});

	it('drops the field rather than sending an update the server would reject', () => {
		// The server caps at `GAUZY_DOCS_MAX_BINARY_BYTES`; over it, the whole content save
		// would 400 — the JSON matters, the reserved seed does not.
		expect(encodeContentBinary(encoderOf(new Uint8Array([1, 2, 3, 4])), schema, json, 3)).toBeNull();
	});

	it('drops an empty update', () => {
		expect(encodeContentBinary(encoderOf(new Uint8Array()), schema, json)).toBeNull();
	});

	it('never lets an encoder failure escape into the save', () => {
		const throwing: ICrdtEncoder = {
			encode: () => {
				throw new Error('schema mismatch');
			}
		};
		expect(() => encodeContentBinary(throwing, schema, json)).not.toThrow();
		expect(encodeContentBinary(throwing, schema, json)).toBeNull();
	});
});

describe('toBase64', () => {
	it('round-trips through atob', () => {
		const bytes = Uint8Array.from([0, 1, 127, 128, 255]);
		const decoded = Uint8Array.from(atob(toBase64(bytes)), (character) => character.charCodeAt(0));
		expect([...decoded]).toEqual([...bytes]);
	});

	it('chunks large inputs instead of blowing the argument limit', () => {
		// `String.fromCharCode(...bytes)` throws RangeError well before this size — which, in
		// a save path, would have surfaced as a failed save rather than a skipped field.
		const bytes = new Uint8Array(200_000).fill(65);
		expect(() => toBase64(bytes)).not.toThrow();
		expect(atob(toBase64(bytes))).toHaveLength(200_000);
	});
});
