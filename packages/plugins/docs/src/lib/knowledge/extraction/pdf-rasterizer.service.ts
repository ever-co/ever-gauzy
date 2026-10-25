import { Injectable, Logger } from '@nestjs/common';
import { createRequire } from 'module';
import { dirname, isAbsolute, join } from 'path';
import { pathToFileURL } from 'url';
import { DocsTransientError, isTransientError } from '../errors';

/** Render scale for OCR/thumbnail rasterization — 150 DPI against the PDF's 72 dpi user space. */
export const PDF_RASTER_DPI = 150;

/** Longest side a rendered page is allowed to reach, in pixels (memory fuse per page). */
export const PDF_RASTER_MAX_PX = 2200;

/** What `getDocument` hands back: the document promise, and the task that releases it. */
interface IPdfLoadingTask {
	promise: Promise<any>;
	destroy?: () => Promise<void>;
}

/** The lazily-loaded renderer: the pdf.js entry point, a canvas factory, and its asset paths. */
interface IPdfRenderer {
	pdfjs: { getDocument: (options: Record<string, unknown>) => IPdfLoadingTask };
	createCanvas: (width: number, height: number) => any;
	/**
	 * Extra `getDocument` options: `standardFontDataUrl` / `cMapUrl` resolved inside the chosen
	 * `pdfjs-dist`, and the `CanvasFactory` that keeps pdf.js on our canvas copy.
	 */
	assetOptions: Record<string, unknown>;
}

/** The parts of `@napi-rs/canvas` the renderer uses. */
export interface ICanvasModule {
	createCanvas: (width: number, height: number) => any;
	DOMMatrix?: unknown;
	ImageData?: unknown;
	Path2D?: unknown;
}

/** Where the renderer loads pdf.js from, and the `require`s that can reach a canvas copy. */
export interface IPdfRendererLocation {
	/** Absolute path of the chosen `pdfjs-dist/package.json`. */
	pdfjsPackageJson: string;
	/** `require` functions that can load `@napi-rs/canvas`, most preferred first. */
	canvasRequires: NodeJS.Require[];
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
		let loadingTask: IPdfLoadingTask | undefined;
		try {
			loadingTask = renderer.pdfjs.getDocument({
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
			});
			document = await loadingTask.promise;
		} catch (error) {
			// A file pdf.js cannot open is not a rasterizer problem — the text-layer pass
			// already classified it. Report "nothing rendered" and let the caller decide.
			this.logger.debug(`PDF rasterization could not open the document: ${(error as Error).message}`);
			// A rejected load does not release the task's worker and transport by itself (corrupt or
			// password-protected uploads land here): best-effort, as in the `finally` below.
			try {
				await loadingTask?.destroy?.();
			} catch {
				// Cleanup only.
			}
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
			// `finally`, and mask the real error — so the await is wrapped instead. The loading
			// task releases the document in every pdf.js generation; pdfjs-dist 6 dropped
			// `PDFDocumentProxy.destroy`, so the document's own method is only the fallback.
			try {
				if (typeof loadingTask?.destroy === 'function') {
					await loadingTask.destroy();
				} else {
					await document.destroy?.();
				}
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
	 * `pdfjs-dist` ships ESM only, and this package compiles to CommonJS — so the loader
	 * mirrors `@gauzy/plugin-ai-chat`'s ESM interop: `require(esm)` first (native on Node >=
	 * 22.12), then a genuine dynamic `import()` built through the `Function` constructor so
	 * TypeScript cannot rewrite it back into a `require`.
	 *
	 * 🛑 **ONE copy of `@napi-rs/canvas` for everything, or the process dies.** Since pdf-parse 2
	 * (2026-10 dependency upgrade) the API installs pdf.js and several canvas copies: pdf-parse
	 * pins canvas 0.1.80 exactly and sets `globalThis.Path2D/DOMMatrix/ImageData` from it when
	 * it loads (at boot, through `pdf.extractor.ts`); its pdfjs-dist 5 resolves `^0.1.80` to its
	 * own nested 0.1.100 for the scratch canvases it draws images through; a full install adds
	 * docs-ui's pdfjs-dist 6 with canvas 1.x at the top level. Drawing a canvas of one copy onto
	 * a context of another is a SEGMENTATION FAULT (no JS error, no Sentry event: the worker
	 * just exits 139, and BullMQ retries the job into the next crash); a path of one copy on a
	 * context of another throws "Value is none of these types `String`, `Path`". So:
	 * - pdf.js is the copy pdf-parse ships with (the top-level one in a full install is the
	 *   browser viewer's), see {@link locatePdfRenderer};
	 * - the canvas is the copy the `Path2D` global already comes from, see {@link pickCanvasModule};
	 * - pdf.js gets a `CanvasFactory` on that same copy instead of its own `require`.
	 */
	private async loadRenderer(): Promise<IPdfRenderer | null> {
		if (this.renderer !== undefined) {
			return this.renderer;
		}
		try {
			const location = locatePdfRenderer();
			if (!location) {
				throw new Error('pdfjs-dist is not installed');
			}
			const canvas = pickCanvasModule(location.canvasRequires);
			if (!canvas) {
				throw new Error('@napi-rs/canvas is not installed');
			}
			// pdf.js polyfills these from ITS canvas copy when they are missing: set them from
			// ours first (pdf-parse normally already has, from the same copy).
			installCanvasGlobals(canvas);

			const pdfjsRoot = dirname(location.pdfjsPackageJson);
			const pdfjs: any = await importOptional(join(pdfjsRoot, 'legacy', 'build', 'pdf.mjs'));
			const getDocument = pdfjs?.getDocument ?? pdfjs?.default?.getDocument;

			if (typeof getDocument !== 'function') {
				throw new Error('the module did not expose getDocument');
			}
			this.renderer = {
				pdfjs: { getDocument: getDocument.bind(pdfjs) },
				createCanvas: (width: number, height: number) => canvas.createCanvas(width, height),
				assetOptions: {
					...resolvePdfjsAssetOptions(pdfjsRoot),
					CanvasFactory: createCanvasFactory(canvas)
				}
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
 * Chooses the `pdfjs-dist` the renderer loads: the one `pdf-parse` depends on when pdf-parse is
 * installed (it is in every API install, and its canvas copies are the ones already loaded),
 * otherwise whatever `pdfjs-dist` resolves to from here.
 *
 * @param baseRequire The `require` to resolve from (a seam for the specs).
 * @returns The chosen package and the `require`s that can reach a canvas copy — pdf-parse's
 *          first, then pdf.js's own, then this package's — or `null` without any pdf.js.
 */
export function locatePdfRenderer(baseRequire: NodeJS.Require = require): IPdfRendererLocation | null {
	let viaPdfParse: NodeJS.Require | null = null;
	try {
		viaPdfParse = createRequire(baseRequire.resolve('pdf-parse'));
	} catch {
		// No pdf-parse: fall back to the pdf.js this package resolves.
	}
	for (const candidate of [viaPdfParse, baseRequire]) {
		if (!candidate) {
			continue;
		}
		try {
			const pdfjsPackageJson = candidate.resolve('pdfjs-dist/package.json');
			return {
				pdfjsPackageJson,
				canvasRequires: [viaPdfParse, createRequire(pdfjsPackageJson), baseRequire].filter(
					(item): item is NodeJS.Require => !!item
				)
			};
		} catch {
			// Not resolvable from this candidate; try the next.
		}
	}
	return null;
}

/**
 * Picks the `@napi-rs/canvas` copy to render with: the one the `Path2D` global already comes
 * from (pdf-parse sets it from its own copy when it loads), otherwise the most preferred copy
 * that loads. A copy loaded twice from the same path is the same module, so this is identity.
 *
 * @param requires The `require`s to try, most preferred first.
 * @param globals Where the `Path2D` global lives (a seam for the specs).
 * @returns The canvas module, or `null` when no copy loads.
 */
export function pickCanvasModule(
	requires: Array<(id: string) => any>,
	globals: { Path2D?: unknown } = globalThis as any
): ICanvasModule | null {
	const loaded: ICanvasModule[] = [];
	for (const load of requires) {
		try {
			const loadedModule = load('@napi-rs/canvas');
			const canvas = typeof loadedModule?.createCanvas === 'function' ? loadedModule : loadedModule?.default;
			if (typeof canvas?.createCanvas === 'function') {
				loaded.push(canvas);
			}
		} catch {
			// This copy is not installed here; try the next.
		}
	}
	if (loaded.length === 0) {
		return null;
	}
	const path2d = globals.Path2D;
	return (path2d && loaded.find((canvas) => canvas.Path2D === path2d)) || loaded[0];
}

/**
 * Sets `DOMMatrix` / `ImageData` / `Path2D` from `canvas` where they are not defined yet, as
 * pdf.js and pdf-parse do from their own copies — so whichever loads next finds ours.
 */
export function installCanvasGlobals(canvas: ICanvasModule, globals: Record<string, unknown> = globalThis as any): void {
	for (const name of ['DOMMatrix', 'ImageData', 'Path2D'] as const) {
		if (!globals[name] && canvas[name]) {
			globals[name] = canvas[name];
		}
	}
}

/**
 * A pdf.js `CanvasFactory` (the `BaseCanvasFactory` contract: `create` / `reset` / `destroy`)
 * that makes pdf.js's scratch canvases — the ones images and patterns are drawn through — from
 * `canvas`, the same copy the page canvas comes from. pdf.js's default Node factory would
 * `require` its own copy instead.
 */
export function createCanvasFactory(canvas: ICanvasModule) {
	return class GauzyPdfCanvasFactory {
		// pdf.js constructs it with `{ enableHWA }`; a software canvas has nothing to configure.
		constructor(_options?: { enableHWA?: boolean }) {}

		create(width: number, height: number): { canvas: any; context: any } {
			if (width <= 0 || height <= 0) {
				throw new Error('Invalid canvas size');
			}
			const created = canvas.createCanvas(width, height);
			return { canvas: created, context: created.getContext('2d') };
		}

		reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number): void {
			if (!canvasAndContext.canvas) {
				throw new Error('Canvas is not specified');
			}
			if (width <= 0 || height <= 0) {
				throw new Error('Invalid canvas size');
			}
			canvasAndContext.canvas.width = width;
			canvasAndContext.canvas.height = height;
		}

		destroy(canvasAndContext: { canvas: any; context: any }): void {
			if (!canvasAndContext.canvas) {
				throw new Error('Canvas is not specified');
			}
			// Zeroing the size releases the backing store before GC gets to it.
			canvasAndContext.canvas.width = 0;
			canvasAndContext.canvas.height = 0;
			canvasAndContext.canvas = null;
			canvasAndContext.context = null;
		}
	};
}

/**
 * Locates the font/CMap data bundled inside the chosen `pdfjs-dist` and returns it as
 * `getDocument` options. Both are LOCAL directory paths (with the trailing separator pdf.js
 * expects) — nothing is fetched over the network.
 *
 * An empty object is a valid answer: a layout that hides the package root simply loses
 * standard-font glyphs and CJK CMaps, which is degraded output rather than a failure.
 *
 * @param pdfjsRoot The directory of the `pdfjs-dist` package the renderer loaded.
 */
function resolvePdfjsAssetOptions(pdfjsRoot: string): Record<string, unknown> {
	try {
		return {
			standardFontDataUrl: `${join(pdfjsRoot, 'standard_fonts')}/`,
			cMapUrl: `${join(pdfjsRoot, 'cmaps')}/`,
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
			// `import()` takes URLs: an absolute Windows path (`C:\…`) would read as a scheme.
			return await dynamicImport(isAbsolute(specifier) ? pathToFileURL(specifier).href : specifier);
		} catch {
			throw requireError;
		}
	}
}
