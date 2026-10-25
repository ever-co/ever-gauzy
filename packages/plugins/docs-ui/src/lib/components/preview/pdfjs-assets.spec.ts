import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { PDFJS_WASM_ASSET_PATH, pdfjsDocumentParams, resolvePdfjsWasmUrl } from './pdfjs-assets';

/**
 * pdfjs-dist 4 -> 6 (2026-10 dependency upgrade): 5+ loads its JBIG2 / CCITT fax / JPEG 2000 decoders
 * from the `wasmUrl` document parameter (4.x had them built in), so without it every black-and-white
 * scan or fax previewed with blank images. The viewer passes the directory the web app serves
 * `pdfjs-dist/wasm` at; these specs pin the URL and that every web build target really serves it.
 */
describe('pdf.js assets for the Documents preview', () => {
	describe('resolvePdfjsWasmUrl', () => {
		it('resolves against the base href, not the hash route', () => {
			expect(resolvePdfjsWasmUrl('https://app.example.com/')).toBe('https://app.example.com/assets/pdfjs/wasm/');
			expect(resolvePdfjsWasmUrl('https://app.example.com/#/pages/documents')).toBe(
				'https://app.example.com/assets/pdfjs/wasm/'
			);
			expect(resolvePdfjsWasmUrl('https://example.com/gauzy/index.html')).toBe(
				'https://example.com/gauzy/assets/pdfjs/wasm/'
			);
		});

		it('ends with a slash, as pdf.js appends the file names to it', () => {
			expect(resolvePdfjsWasmUrl('file:///opt/app/index.html')).toBe('file:///opt/app/assets/pdfjs/wasm/');
		});
	});

	it('builds getDocument parameters that carry the data and the wasmUrl', () => {
		const data = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

		expect(pdfjsDocumentParams(data, 'https://app.example.com/#/pages/documents')).toEqual({
			data,
			wasmUrl: 'https://app.example.com/assets/pdfjs/wasm/'
		});
	});

	it('is served by every build target of the web app (apps/gauzy/project.json assets)', () => {
		let root = __dirname;
		while (!existsSync(join(root, 'nx.json')) && dirname(root) !== root) {
			root = dirname(root);
		}
		const project = JSON.parse(readFileSync(join(root, 'apps/gauzy/project.json'), 'utf8'));
		const targetsWithAssets = Object.entries<any>(project.targets).filter(([, target]) => target.options?.assets);

		expect(targetsWithAssets.map(([name]) => name)).toEqual(expect.arrayContaining(['build']));
		for (const [name, target] of targetsWithAssets) {
			const entry = target.options.assets.find(
				(asset: any) => typeof asset === 'object' && asset.input === 'node_modules/pdfjs-dist/wasm'
			);
			expect({ target: name, output: entry?.output }).toEqual({ target: name, output: PDFJS_WASM_ASSET_PATH });
		}
	});
});
