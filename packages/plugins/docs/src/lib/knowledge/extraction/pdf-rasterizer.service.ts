import { Injectable, Logger } from '@nestjs/common';
import { DocsTransientError, isTransientError } from '../errors';

/** Render scale for OCR/thumbnail rasterization — 150 DPI against the PDF's 72 dpi user space. */
export const PDF_RASTER_DPI = 150;

/** Longest side a rendered page is allowed to reach, in pixels (memory fuse per page). */
export const PDF_RASTER_MAX_PX = 2200;

/** The lazily-loaded renderer: the pdf.js entry point, a canvas factory, and its asset paths. */
interface IPdfRenderer {
	pdfjs: { getDocument: (options: Record<string, unknown>) => { promise: Promise<any> } };
	createCanvas: (width: number, height: number) => any;
	/** `standardFontDataUrl` / `cMapUrl` resolved inside the installed `pdfjs-dist`. */
	assetOptions: Record<string, unknown>;
}

/** What one rasterization run produced. */
export interface IPdfRasterResult {
	/** PNG bytes, one per rendered page, in page order. */
	pages: Buffer[];
	/** Total pages in the document — may exceed `pages.length` when a cap was applied. */
	pageCount: number;
}

/**
 * PDF → PNG page rasterization, used by BOTH consumers that need pixels out of a PDF:
 * the OCR path (every page, capped) and the thumbnail path (page 1 only).
 *
 * 🛑 **The renderer is an OPTIONAL runtime dependency, deliberately.** `sharp` — which the
 * plugin already ships — cannot help here: the prebuilt libvips advertises a `pdf` format but
 * with `input: { file: false, buffer: false }`, i.e. no poppler/pdfium was compiled in, so a
 * PDF buffer is simply not loadable. Actually rasterizing needs `pdfjs-dist` plus a native
 * canvas (`@napi-rs/canvas`, which `pdfjs-dist` itself declares as an optional dependency).
 * Making those *hard* dependencies of the backend plugin would force a per-platform native
 * binary into every Gauzy API install for two cosmetic/opt-in features, so they are loaded the
 * same defensive way `DocsAiService` loads `@gauzy/plugin-ai-chat`: try, cache, and report
 * "unavailable" forever after a failure.
 *
 * Unavailable is never an error here — it is a capability answer:
 * - thumbnails skip the PDF (the UI falls back to the kind icon);
 * - scanned-PDF OCR reports "not available", so the document keeps today's permanent
 *   extraction failure instead of silently changing behavior.
 *
 * Image OCR needs none of this — it runs on `sharp` alone.
 */
@Injectable()
export class PdfRasterizerService {
	private readonly logger = new Logger(PdfRasterizerService.name);

	/** `undefined` = not tried yet, `null` = tried and unavailable. */
	private renderer?: IPdfRenderer | null;

	/**
	 * True when a PDF renderer could be loaded in this process.
	 *
	 * @returns Whether {@link renderPages} can produce anything.
	 */
	public async isAvailable(): Promise<boolean> {
		return (await this.loadRenderer()) !== null;
	}

	/**
	 * Renders the leading pages of a PDF to PNG buffers.
	 *
	 * @param buffer The PDF bytes.
	 * @param maxPages Maximum pages to render (>= 1). Remaining pages are reported through
	 *                 `pageCount` so the caller can emit an honest truncation note.
	 * @returns The rendered pages, or `null` when no renderer is available in this process.
	 * @throws DocsTransientError when the renderer itself fails mid-run (a retry may succeed).
	 */
	public async renderPages(buffer: Buffer, maxPages: number): Promise<IPdfRasterResult | null> {
		const renderer = await this.loadRenderer();
		if (!renderer) {
			return null;
		}

		let document: any;
		try {
			document = await renderer.pdfjs.getDocument({
				// A standalone copy: pdf.js resolves offsets against `bytes.buffer`, and a
				// pooled Node Buffer shares an 8 KiB allocation pool (see `pdf.extractor.ts`).
				data: new Uint8Array(buffer),
				// Untrusted input: no eval, no remote font/CMap fetches, no worker process.
				isEvalSupported: false,
				useWorkerFetch: false,
				useSystemFonts: false,
				disableFontFace: true,
				// 🛑 Without these the render is SILENTLY USELESS for our purpose. pdf.js has
				// no built-in glyph outlines for the 14 standard PDF fonts (Helvetica, Times,
				// Courier…) — with `disableFontFace` on and no font data it logs
				// "ignoring character" per glyph and rasterizes a page with the *text
				// missing*. A thumbnail would look blank and OCR would transcribe nothing,
				// with no error anywhere. The data ships inside `pdfjs-dist`; these point at
				// it on disk (local paths — still zero network access).
				...renderer.assetOptions
			}).promise;
		} catch (error) {
			// A file pdf.js cannot open is not a rasterizer problem — the text-layer pass
			// already classified it. Report "nothing rendered" and let the caller decide.
			this.logger.debug(`PDF rasterization could not open the document: ${(error as Error).message}`);
			return null;
		}

		const pageCount = Number(document.numPages) || 0;
		const limit = Math.max(0, Math.min(pageCount, Math.max(1, maxPages)));
		const pages: Buffer[] = [];

		try {
			for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
				pages.push(await this.renderPage(renderer, document, pageNumber));
			}
		} catch (error) {
			if (isTransientError(error)) {
				throw error;
			}
			throw new DocsTransientError('The PDF pages could not be rendered for transcription.', error);
		} finally {
			// pdf.js holds page buffers until the document is destroyed. `?.()` guards the
			// method, NOT its result — `undefined.catch()` would throw right here, inside a
			// `finally`, and mask the real error — so the await is wrapped instead.
			try {
				await document.destroy?.();
			} catch {
				// Cleanup is best-effort; the pages are already rendered.
			}
		}

		return { pages, pageCount };
	}

	/**
	 * Renders exactly one page to PNG bytes at {@link PDF_RASTER_DPI}, clamped so no single
	 * page can allocate an unbounded canvas.
	 */
	private async renderPage(
		renderer: IPdfRenderer,
		document: any,
		pageNumber: number
	): Promise<Buffer> {
		const page = await document.getPage(pageNumber);
		try {
			// PDF user space is 72 dpi, so the nominal scale is DPI/72. A poster-sized page
			// would allocate a canvas of hundreds of megapixels at that scale, hence the clamp.
			const nominalScale = PDF_RASTER_DPI / 72;
			const base = page.getViewport({ scale: nominalScale });
			const longest = Math.max(base.width, base.height);
			const scale =
				longest > PDF_RASTER_MAX_PX ? nominalScale * (PDF_RASTER_MAX_PX / longest) : nominalScale;
			const viewport = page.getViewport({ scale });

			const canvas = renderer.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
			const context = canvas.getContext('2d');
			await page.render({ canvas, canvasContext: context, viewport }).promise;

			return Buffer.from(canvas.toBuffer('image/png'));
		} finally {
			page.cleanup?.();
		}
	}

	/**
	 * Loads `pdfjs-dist` + `@napi-rs/canvas` once, caching both the success and the failure.
	 *
	 * `pdfjs-dist` v4 ships ESM only, and this package compiles to CommonJS — so the loader
	 * mirrors `@gauzy/plugin-ai-chat`'s ESM interop: `require(esm)` first (native on Node >=
	 * 22.12), then a genuine dynamic `import()` built through the `Function` constructor so
	 * TypeScript cannot rewrite it back into a `require`.
	 */
	private async loadRenderer(): Promise<IPdfRenderer | null> {
		if (this.renderer !== undefined) {
			return this.renderer;
		}
		try {
			const pdfjs: any = await importOptional('pdfjs-dist/legacy/build/pdf.mjs');
			const canvas: any = await importOptional('@napi-rs/canvas');
			const createCanvas = canvas?.createCanvas ?? canvas?.default?.createCanvas;
			const getDocument = pdfjs?.getDocument ?? pdfjs?.default?.getDocument;

			if (typeof createCanvas !== 'function' || typeof getDocument !== 'function') {
				throw new Error('the module did not expose getDocument/createCanvas');
			}
			this.renderer = {
				pdfjs: { getDocument: getDocument.bind(pdfjs) },
				createCanvas,
				assetOptions: resolvePdfjsAssetOptions()
			};
			this.logger.log('PDF rasterizer available (pdfjs-dist + @napi-rs/canvas).');
		} catch (error) {
			this.logger.log(
				`PDF rasterizer unavailable (${(error as Error).message}) — PDF thumbnails are skipped and ` +
					'scanned-PDF OCR reports "not available". Image OCR is unaffected.'
			);
			this.renderer = null;
		}
		return this.renderer;
	}
}

/**
 * Locates the font/CMap data bundled inside the installed `pdfjs-dist` and returns it as
 * `getDocument` options. Both are LOCAL directory paths (with the trailing separator pdf.js
 * expects) — nothing is fetched over the network.
 *
 * An empty object is a valid answer: a layout that hides the package root simply loses
 * standard-font glyphs and CJK CMaps, which is degraded output rather than a failure.
 */
function resolvePdfjsAssetOptions(): Record<string, unknown> {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { dirname, join } = require('path');
		const root = dirname(require.resolve('pdfjs-dist/package.json'));
		return {
			standardFontDataUrl: `${join(root, 'standard_fonts')}/`,
			cMapUrl: `${join(root, 'cmaps')}/`,
			cMapPacked: true
		};
	} catch {
		return {};
	}
}

/**
 * `require()` an optional module, falling back to a real dynamic `import()` for ESM-only
 * packages. Mirrors `@gauzy/plugin-ai-chat`'s `esm-loader`, kept local so the Documents
 * plugin never depends on the chat plugin at load time.
 *
 * @param specifier The module specifier to load.
 */
async function importOptional(specifier: string): Promise<unknown> {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		return require(specifier);
	} catch (requireError: any) {
		// 🛑 The fallback is NOT limited to `ERR_REQUIRE_ESM` / `ERR_REQUIRE_ASYNC_MODULE`.
		// Node's own `require(esm)` reports those, but a host that intercepts the module
		// registry does not: Jest, for one, hands the `.mjs` to its CommonJS transform and
		// fails with a bare `SyntaxError: Cannot use 'import.meta' outside a module`. Keying
		// the fallback on the error code made the module look *absent* under those hosts. Any
		// require failure now gets one honest `import()` attempt; if that fails too, the
		// original require error is the one reported, since it is the more diagnostic of the
		// two for a genuinely missing package.
		try {
			const dynamicImport = new Function('specifier', 'return import(specifier);') as (
				specifier: string
			) => Promise<unknown>;
			return await dynamicImport(specifier);
		} catch {
			throw requireError;
		}
	}
}
