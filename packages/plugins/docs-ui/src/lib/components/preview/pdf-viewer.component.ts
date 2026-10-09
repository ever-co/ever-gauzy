import {
	Component,
	ElementRef,
	EventEmitter,
	Input,
	OnChanges,
	OnDestroy,
	Output,
	SimpleChanges,
	ViewChild
} from '@angular/core';

/** Minimal structural typings for the parts of pdfjs-dist the viewer touches. */
interface PdfPageProxy {
	getViewport(params: { scale: number }): { width: number; height: number };
	render(params: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }): {
		promise: Promise<void>;
	};
}

interface PdfDocumentProxy {
	numPages: number;
	getPage(page: number): Promise<PdfPageProxy>;
	destroy(): Promise<void>;
}

/**
 * Minimal pdfjs-dist wrapper (`01-ux-spec.md` §9): renders one page at a time
 * to a canvas with page navigation and zoom. The library (and its worker
 * module) loads through a dynamic import so pdfjs never ships in the browse
 * chunk; when worker creation fails, the main-thread module registered as
 * `globalThis.pdfjsWorker` drives pdf.js's fake-worker path.
 */
@Component({
	selector: 'gz-docs-pdf-viewer',
	template: `
		<div class="docs-pdf" [nbSpinner]="loading" nbSpinnerStatus="primary">
			<div class="docs-pdf-canvas-host">
				<canvas #canvas></canvas>
			</div>
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
				height: 100%;
			}
			.docs-pdf {
				height: 100%;
				overflow: auto;
				text-align: center;
			}
			canvas {
				max-width: 100%;
				box-shadow: var(--shadow);
			}
		`
	],
	standalone: false
})
export class PdfViewerComponent implements OnChanges, OnDestroy {
	@Input() src: Blob | null = null;
	/** 1-based page to open on (citation locator support). */
	@Input() initialPage = 1;

	@Output() loaded = new EventEmitter<{ totalPages: number }>();
	@Output() renderFailed = new EventEmitter<void>();
	@Output() pageChanged = new EventEmitter<{ page: number; totalPages: number }>();

	@ViewChild('canvas', { static: true }) canvasRef: ElementRef<HTMLCanvasElement>;

	public loading = false;
	public page = 1;
	public totalPages = 0;
	public scale = 1.25;

	private pdf: PdfDocumentProxy | null = null;
	private destroyed = false;

	async ngOnChanges(changes: SimpleChanges): Promise<void> {
		if (changes['src'] && this.src) {
			await this.load(this.src);
		}
	}

	ngOnDestroy(): void {
		this.destroyed = true;
		void this.pdf?.destroy();
		this.pdf = null;
	}

	// ─── Navigation / zoom (driven by the modal chrome) ──────────

	async next(): Promise<void> {
		if (this.pdf && this.page < this.totalPages) {
			this.page++;
			await this.renderPage();
		}
	}

	async prev(): Promise<void> {
		if (this.pdf && this.page > 1) {
			this.page--;
			await this.renderPage();
		}
	}

	async zoomIn(): Promise<void> {
		this.scale = Math.min(4, this.scale + 0.25);
		await this.renderPage();
	}

	async zoomOut(): Promise<void> {
		this.scale = Math.max(0.5, this.scale - 0.25);
		await this.renderPage();
	}

	// ─── Internals ───────────────────────────────────────────────

	private async load(blob: Blob): Promise<void> {
		this.loading = true;
		try {
			const pdfjs = await this.loadPdfjs();
			const data = new Uint8Array(await blob.arrayBuffer());
			const document = (await pdfjs.getDocument({ data }).promise) as PdfDocumentProxy;
			if (this.destroyed) {
				void document.destroy();
				return;
			}
			this.pdf = document;
			this.totalPages = document.numPages;
			this.page = Math.min(Math.max(1, this.initialPage), this.totalPages);
			this.loaded.emit({ totalPages: this.totalPages });
			await this.renderPage();
		} catch {
			this.renderFailed.emit();
		} finally {
			this.loading = false;
		}
	}

	/** Dynamic import + worker setup; falls back to the main-thread fake worker. */
	private async loadPdfjs(): Promise<{
		getDocument(params: { data: Uint8Array }): { promise: Promise<unknown> };
	}> {
		const pdfjs = (await import('pdfjs-dist')) as unknown as {
			GlobalWorkerOptions: { workerSrc: string; workerPort: Worker | null };
			getDocument(params: { data: Uint8Array }): { promise: Promise<unknown> };
		};
		if (!pdfjs.GlobalWorkerOptions.workerSrc && !pdfjs.GlobalWorkerOptions.workerPort) {
			try {
				pdfjs.GlobalWorkerOptions.workerPort = new Worker(
					new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
					{ type: 'module' }
				);
			} catch {
				// Registers globalThis.pdfjsWorker — pdf.js's fake worker picks it up.
				await import('pdfjs-dist/build/pdf.worker.min.mjs' as string);
			}
		}
		return pdfjs;
	}

	private async renderPage(): Promise<void> {
		if (!this.pdf) return;
		try {
			const page = await this.pdf.getPage(this.page);
			const viewport = page.getViewport({ scale: this.scale });
			const canvas = this.canvasRef.nativeElement;
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			const context = canvas.getContext('2d');
			if (!context) return;
			await page.render({ canvasContext: context, viewport, canvas }).promise;
			this.pageChanged.emit({ page: this.page, totalPages: this.totalPages });
		} catch {
			this.renderFailed.emit();
		}
	}
}
