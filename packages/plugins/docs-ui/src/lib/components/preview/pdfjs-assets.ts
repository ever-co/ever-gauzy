/**
 * Where the web app serves `node_modules/pdfjs-dist/wasm` (an `assets` entry of every build target in
 * `apps/gauzy/project.json`).
 *
 * pdfjs-dist 5+ decodes JBIG2 and CCITT fax images (black-and-white scans, faxes) and JPEG 2000 with
 * WebAssembly modules — or their JS fallbacks — that it loads from the `wasmUrl` document parameter;
 * 4.x had those decoders built in. Without `wasmUrl` every such image previews blank ("JBig2 failed to
 * initialize"). The same directory gives pdf.js its ICC colour module.
 */
export const PDFJS_WASM_ASSET_PATH = 'assets/pdfjs/wasm/';

/** What the viewer passes to pdf.js's `getDocument`. */
export interface PdfjsDocumentParams {
	data: Uint8Array;
	/** Absolute directory URL, with the trailing slash pdf.js appends file names to. */
	wasmUrl: string;
}

/**
 * The absolute `wasmUrl` for a page whose base URI is `baseURI`: assets are served under the base
 * href, and the app's hash route takes no part in it.
 */
export function resolvePdfjsWasmUrl(baseURI: string): string {
	return new URL(PDFJS_WASM_ASSET_PATH, baseURI).href;
}

/** `getDocument` parameters for `data` on a page whose base URI is `baseURI`. */
export function pdfjsDocumentParams(data: Uint8Array, baseURI: string): PdfjsDocumentParams {
	return { data, wasmUrl: resolvePdfjsWasmUrl(baseURI) };
}
