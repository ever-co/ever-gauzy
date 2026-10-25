/**
 * PDF rasterizer: one `@napi-rs/canvas` copy for everything.
 *
 * Since the 2026-10 dependency upgrade (pdf-parse 1 -> 2) the API installs pdf.js together
 * with several canvas copies: pdf-parse pins 0.1.80 and sets the `Path2D` / `DOMMatrix` /
 * `ImageData` globals from it at boot, its pdfjs-dist 5 resolves its own 0.1.100, and a full
 * install adds docs-ui's pdfjs-dist 6 with canvas 1.x at the top level. The renderer used to
 * take the top-level pdf.js and the top-level canvas, so pdf.js drew its scratch canvases (a
 * raster image on the page goes through one) from a different copy than the page canvas: a
 * SEGMENTATION FAULT for any PDF with an image on page 1, i.e. the worker dying on every
 * `docs.thumbnail` job for such an upload. These specs pin the three rules that prevent it,
 * and render a real image-bearing PDF after pdf-parse loaded, as the API does.
 */
import { createRequire } from 'module';
import * as sharpModule from 'sharp';
import { createImagePdf } from './__fixtures__';
import {
	createCanvasFactory,
	installCanvasGlobals,
	locatePdfRenderer,
	pickCanvasModule,
	PDF_RASTER_DPI,
	PdfRasterizerService
} from './pdf-rasterizer.service';

// sharp 0.35 types its entry point as an ES module (a default export), while `require('sharp')` still returns the
// function itself: take whichever this runtime hands back.
const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ??
	sharpModule) as unknown as typeof sharpModule.default;

/** A stand-in canvas module whose classes are unique objects, so identity is observable. */
function fakeCanvasModule(name: string) {
	class Path2D {}
	class DOMMatrix {}
	class ImageData {}
	return {
		name,
		Path2D,
		DOMMatrix,
		ImageData,
		createCanvas: jest.fn((width: number, height: number) => ({
			width,
			height,
			getContext: jest.fn(() => ({ owner: name }))
		}))
	};
}

/** Whether `id` resolves from this package (the integration case needs the real libraries). */
function canResolve(id: string): boolean {
	try {
		require.resolve(id);
		return true;
	} catch {
		return false;
	}
}

describe('PdfRasterizerService — one canvas copy', () => {
	describe('locatePdfRenderer', () => {
		(canResolve('pdf-parse') ? it : it.skip)(
			"loads pdf-parse's own pdf.js, not whichever pdfjs-dist is hoisted to the top",
			() => {
				const viaPdfParse = createRequire(require.resolve('pdf-parse'));
				const location = locatePdfRenderer();

				expect(location).not.toBeNull();
				expect(location!.pdfjsPackageJson).toBe(viaPdfParse.resolve('pdfjs-dist/package.json'));
				// pdf-parse's view of the canvas is tried first: it is the copy the globals come from.
				expect(location!.canvasRequires.length).toBeGreaterThanOrEqual(2);
			}
		);

		it('falls back to the pdf.js this package resolves when pdf-parse is not installed', () => {
			const resolve = jest.fn((id: string) => {
				if (id === 'pdfjs-dist/package.json') {
					return require.resolve('pdfjs-dist/package.json');
				}
				throw Object.assign(new Error(`Cannot find module '${id}'`), { code: 'MODULE_NOT_FOUND' });
			});
			const baseRequire = Object.assign(jest.fn(), { resolve }) as unknown as NodeJS.Require;

			const location = canResolve('pdfjs-dist') ? locatePdfRenderer(baseRequire) : null;

			if (location) {
				expect(location.pdfjsPackageJson).toBe(require.resolve('pdfjs-dist/package.json'));
				expect(location.canvasRequires[location.canvasRequires.length - 1]).toBe(baseRequire);
			}
			expect(resolve).toHaveBeenCalledWith('pdf-parse');
		});

		it('reports no renderer when no pdf.js resolves at all', () => {
			const resolve = jest.fn((id: string) => {
				throw Object.assign(new Error(`Cannot find module '${id}'`), { code: 'MODULE_NOT_FOUND' });
			});
			const baseRequire = Object.assign(jest.fn(), { resolve }) as unknown as NodeJS.Require;

			expect(locatePdfRenderer(baseRequire)).toBeNull();
		});
	});

	describe('pickCanvasModule', () => {
		it('takes the copy the Path2D global already comes from, even when it is not the first', () => {
			const pdfParseCopy = fakeCanvasModule('pdf-parse');
			const pdfjsCopy = fakeCanvasModule('pdfjs');
			const globals = { Path2D: pdfjsCopy.Path2D };

			const picked = pickCanvasModule([() => pdfParseCopy, () => pdfjsCopy], globals);

			expect(picked).toBe(pdfjsCopy);
		});

		it('takes the most preferred copy that loads when no Path2D global is set yet', () => {
			const pdfParseCopy = fakeCanvasModule('pdf-parse');
			const pdfjsCopy = fakeCanvasModule('pdfjs');
			const missing = () => {
				throw new Error("Cannot find module '@napi-rs/canvas'");
			};

			expect(pickCanvasModule([missing, () => pdfParseCopy, () => pdfjsCopy], {})).toBe(pdfParseCopy);
		});

		it('unwraps an ES-module namespace and reports null when no copy loads', () => {
			const copy = fakeCanvasModule('namespaced');

			expect(pickCanvasModule([() => ({ default: copy })], {})).toBe(copy);
			expect(
				pickCanvasModule(
					[
						() => {
							throw new Error('missing');
						}
					],
					{}
				)
			).toBeNull();
		});
	});

	describe('installCanvasGlobals', () => {
		it('fills only the globals that are missing, so a copy already in use keeps its globals', () => {
			const ours = fakeCanvasModule('ours');
			const existingPath2D = class {};
			const globals: Record<string, unknown> = { Path2D: existingPath2D };

			installCanvasGlobals(ours, globals);

			expect(globals['Path2D']).toBe(existingPath2D);
			expect(globals['DOMMatrix']).toBe(ours.DOMMatrix);
			expect(globals['ImageData']).toBe(ours.ImageData);
		});
	});

	describe('createCanvasFactory', () => {
		it("makes pdf.js's scratch canvases from the given copy (the BaseCanvasFactory contract)", () => {
			const copy = fakeCanvasModule('chosen');
			const Factory = createCanvasFactory(copy);
			const factory = new Factory({ enableHWA: false });

			const created = factory.create(40, 30);
			expect(copy.createCanvas).toHaveBeenCalledWith(40, 30);
			expect(created.context).toEqual({ owner: 'chosen' });

			factory.reset(created, 10, 20);
			expect(created.canvas.width).toBe(10);
			expect(created.canvas.height).toBe(20);

			const canvas = created.canvas;
			factory.destroy(created);
			expect(canvas.width).toBe(0);
			expect(created.canvas).toBeNull();
			expect(created.context).toBeNull();

			expect(() => factory.create(0, 10)).toThrow('Invalid canvas size');
			expect(() => factory.reset({ canvas: null, context: null }, 1, 1)).toThrow('Canvas is not specified');
		});
	});

	describe('renderPages', () => {
		it('hands pdf.js the canvas factory and releases the document through its loading task', async () => {
			const copy = fakeCanvasModule('chosen');
			const CanvasFactory = createCanvasFactory(copy);
			const page = {
				getViewport: jest.fn(({ scale }: { scale: number }) => ({ width: 612 * scale, height: 792 * scale })),
				render: jest.fn(() => ({ promise: Promise.resolve() })),
				cleanup: jest.fn()
			};
			// pdfjs-dist 6: the document proxy has no `destroy`; only the loading task does.
			const document = { numPages: 2, getPage: jest.fn(async () => page) };
			const loadingTask = { promise: Promise.resolve(document), destroy: jest.fn(async () => undefined) };
			const getDocument = jest.fn(() => loadingTask);
			const service = new PdfRasterizerService();
			(service as any).renderer = {
				pdfjs: { getDocument },
				createCanvas: (width: number, height: number) => ({
					...copy.createCanvas(width, height),
					toBuffer: () => Buffer.from('png')
				}),
				assetOptions: { CanvasFactory }
			};

			const result = await service.renderPages(Buffer.from('%PDF-1.4'), 1);

			expect(result).toEqual({ pages: [Buffer.from('png')], pageCount: 2 });
			expect((getDocument.mock.calls[0] as any[])[0]).toEqual(expect.objectContaining({ CanvasFactory }));
			expect(loadingTask.destroy).toHaveBeenCalledTimes(1);
		});
	});

	// The real thing: pdf-parse loaded first (as `pdf.extractor.ts` does at boot), then a PDF
	// with a raster image rendered. With mixed canvas copies this case kills the process.
	(canResolve('pdf-parse') && canResolve('@napi-rs/canvas') ? it : it.skip)(
		'renders a PDF with a raster image after pdf-parse has loaded',
		async () => {
			require('pdf-parse');
			const service = new PdfRasterizerService();

			const available = await service.isAvailable();
			expect(available).toBe(true);

			const result = await service.renderPages(createImagePdf(), 1);

			expect(result?.pageCount).toBe(1);
			expect(result?.pages).toHaveLength(1);
			const { data, info } = await sharp(result!.pages[0])
				.removeAlpha()
				.raw()
				.toBuffer({ resolveWithObject: true });
			const scale = PDF_RASTER_DPI / 72;
			const pixelAt = (xPt: number, yPt: number) => {
				const x = Math.round(xPt * scale);
				const y = Math.round((792 - yPt) * scale);
				const offset = (y * info.width + x) * info.channels;
				return [data[offset], data[offset + 1], data[offset + 2]];
			};
			// Centre of the red image (drawn through pdf.js's scratch canvas) and of the blue rectangle.
			const [imageR, imageG, imageB] = pixelAt(150, 575);
			expect(imageR).toBeGreaterThan(200);
			expect(imageG).toBeLessThan(60);
			expect(imageB).toBeLessThan(60);
			const [rectR, rectG, rectB] = pixelAt(150, 350);
			expect(rectR).toBeLessThan(60);
			expect(rectG).toBeLessThan(60);
			expect(rectB).toBeGreaterThan(200);
		},
		60_000
	);
});
