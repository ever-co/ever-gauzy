import { Schema } from '@tiptap/pm/model';
import { DOCS_EDITOR_MAX_BINARY_BYTES } from '../editor.constants';

/**
 * `contentBinary` producer (spec 05 §9.1 storage table + §11 collaboration readiness).
 *
 * The column, the entity field, the version snapshot and the `yjs` / `y-protocols` /
 * `@tiptap/y-tiptap` dependencies have all existed since M1, but **no save path ever wrote
 * one** — the column was NULL on every row, so the M5 CRDT cutover would start from nothing
 * to migrate. Each content save now carries a Yjs update encoding the same JSON it persists,
 * which is exactly the seed state `prosemirrorJSONToYDoc` is documented for ("importing
 * existing content to a Y.Doc for the first time").
 *
 * 🛑 This is a *seed*, not a live CRDT log: once collaboration is on, the binary log becomes
 * canonical and must be rehydrated from storage, never re-derived from JSON (all history
 * would be lost). The M5 sync service therefore has to stop this write when it takes over.
 *
 * 🛑 `yjs` + `@tiptap/y-tiptap` are loaded through a **dynamic import**. A static import would
 * add them to the tier-2 editor chunk, which spec 05 §12 caps at 260 KB gz; this way they land
 * in their own chunk, fetched once in the background while the first edit is still being typed.
 */

/** Encodes a document's canonical JSON as a Yjs update. */
export interface ICrdtEncoder {
	encode(schema: Schema, contentJson: unknown): Uint8Array;
}

/** Shape of the two modules actually used, kept local so the dynamic import needs no types. */
interface IYjsModule {
	encodeStateAsUpdate(doc: unknown): Uint8Array;
}
interface IYTiptapModule {
	prosemirrorJSONToYDoc(schema: unknown, state: unknown, xmlFragment?: string): { destroy(): void };
}

let encoderPromise: Promise<ICrdtEncoder | null> | null = null;

/**
 * Loads (once) the CRDT encoder chunk.
 *
 * Resolves to `null` when the chunk cannot be fetched — a content save must never fail
 * because a reserved, forward-looking column could not be filled in.
 */
export function loadCrdtEncoder(): Promise<ICrdtEncoder | null> {
	encoderPromise ??= Promise.all([import('yjs'), import('@tiptap/y-tiptap')])
		.then(([yjs, yTiptap]) => {
			const Y = yjs as unknown as IYjsModule;
			const binding = yTiptap as unknown as IYTiptapModule;
			return {
				encode: (schema: Schema, contentJson: unknown): Uint8Array => {
					const doc = binding.prosemirrorJSONToYDoc(schema, contentJson);
					try {
						return Y.encodeStateAsUpdate(doc);
					} finally {
						// The Y.Doc is a throwaway built for this one encode.
						doc.destroy();
					}
				}
			} as ICrdtEncoder;
		})
		.catch(() => null);
	return encoderPromise;
}

/**
 * Encodes `contentJson` for the wire.
 *
 * @param encoder The loaded encoder, or `null` when the chunk is not ready yet.
 * @param schema The editor's ProseMirror schema — the JSON is parsed against it.
 * @param contentJson The canonical JSON being saved (already upload-sanitized).
 * @param maxBytes Cap on the raw update size, mirroring `GAUZY_DOCS_MAX_BINARY_BYTES`.
 * @returns Base64 of the Yjs update, or `null` when it is unavailable, empty or over the cap.
 */
export function encodeContentBinary(
	encoder: ICrdtEncoder | null,
	schema: Schema | null | undefined,
	contentJson: unknown,
	maxBytes: number = DOCS_EDITOR_MAX_BINARY_BYTES
): string | null {
	if (!encoder || !schema || !contentJson) return null;
	try {
		const update = encoder.encode(schema, contentJson);
		// Over the cap the server would reject the whole save; drop the optional field instead.
		if (!update?.length || update.length > maxBytes) return null;
		return toBase64(update);
	} catch {
		// A schema the JSON does not parse against is a real possibility during a schema
		// migration — the JSON still saves, only the reserved binary is skipped.
		return null;
	}
}

/**
 * Base64 for a byte array.
 *
 * Chunked: `String.fromCharCode(...bytes)` on a multi-megabyte update blows the argument
 * limit and throws `RangeError` — which, before this was chunked, would have surfaced as a
 * failed save rather than a skipped optional field.
 */
export function toBase64(bytes: Uint8Array): string {
	const CHUNK = 0x8000;
	let binary = '';
	for (let index = 0; index < bytes.length; index += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
	}
	return btoa(binary);
}
