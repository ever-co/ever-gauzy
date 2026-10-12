import { parseRawDocumentId, resolveImageSource } from './raw-image.util';

/**
 * Embedded-image source resolution (spec 05 §6.6 step 5).
 *
 * 🛑 The bug this guards: the upload swap persists `src = /api/plugins/docs/documents/{id}/raw`
 * and nothing ever fetched it authenticated, so the browser issued a header-less `<img>` GET
 * against a `DOCS_READ`-guarded route and **every embedded image in every wiki page rendered
 * broken**. Both render paths now key off this helper to decide what to fetch, so the two
 * things worth pinning are: a raw URL yields its id, and a blob/data/external src never does
 * (fetching those through the API would turn a working image into a 404).
 */

const RAW = '/api/plugins/docs/documents/11111111-2222-4333-8444-555555555555/raw';
const DOCUMENT_ID = '11111111-2222-4333-8444-555555555555';

describe('parseRawDocumentId', () => {
	it('reads the id out of the persisted raw-stream URL', () => {
		expect(parseRawDocumentId(RAW)).toBe(DOCUMENT_ID);
	});

	it('reads the id out of an absolute raw-stream URL and one carrying a query', () => {
		expect(parseRawDocumentId(`https://app.gauzy.co${RAW}`)).toBe(DOCUMENT_ID);
		expect(parseRawDocumentId(`${RAW}?v=2`)).toBe(DOCUMENT_ID);
	});

	it('tolerates a deployment that mounts the API under another prefix', () => {
		expect(parseRawDocumentId(`/gauzy/api/v2/plugins/docs/documents/${DOCUMENT_ID}/raw`)).toBe(DOCUMENT_ID);
	});

	it.each([
		['a blob preview of an in-flight upload', 'blob:http://localhost/9f2c-…'],
		['a data URL', 'data:image/png;base64,AAAA'],
		['an external image', 'https://images.example/photo.png'],
		['the download route (not the inline stream)', `/api/plugins/docs/documents/${DOCUMENT_ID}/download`],
		['an empty src', ''],
		['a missing src', null]
	])('returns null for %s', (_case, src) => {
		expect(parseRawDocumentId(src)).toBeNull();
	});

	it('never mistakes a lookalike path inside a data URL for a document id', () => {
		expect(parseRawDocumentId(`data:text/plain,/plugins/docs/documents/${DOCUMENT_ID}/raw`)).toBeNull();
	});
});

describe('resolveImageSource', () => {
	it('prefers the explicit documentId attribute', () => {
		const source = resolveImageSource({ documentId: DOCUMENT_ID, src: RAW });
		expect(source.documentId).toBe(DOCUMENT_ID);
		expect(source.previewSrc).toBe(RAW);
	});

	it('falls back to the raw URL for content authored before the attribute existed', () => {
		expect(resolveImageSource({ src: RAW }).documentId).toBe(DOCUMENT_ID);
	});

	it('leaves an uploading placeholder to render its local blob preview', () => {
		const source = resolveImageSource({ documentId: null, src: 'blob:http://localhost/abc', uploadId: 'upl_1' });
		expect(source.documentId).toBeNull();
		expect(source.previewSrc).toBe('blob:http://localhost/abc');
	});

	it('produces a stable key so a re-render does not re-fetch the bytes', () => {
		const attrs = { documentId: DOCUMENT_ID, src: RAW };
		expect(resolveImageSource(attrs).key).toBe(resolveImageSource({ ...attrs }).key);
	});

	it('produces a new key once the upload swap lands the final attributes', () => {
		const placeholder = resolveImageSource({ documentId: null, src: 'blob:http://localhost/abc' });
		const swapped = resolveImageSource({ documentId: DOCUMENT_ID, src: RAW });
		expect(swapped.key).not.toBe(placeholder.key);
	});

	it('survives a node with no attributes at all', () => {
		expect(resolveImageSource(null)).toEqual({ documentId: null, previewSrc: null, key: '|' });
	});
});
