import { Injectable, SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { catchError, firstValueFrom, of } from 'rxjs';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { DocumentsService } from './documents.service';

/** What the caller already has in hand, so the service does not refetch it. */
export interface IDocsExportSource {
	/** Live editor markdown (`gz-document-editor.getMarkdown()`), when an editor is mounted. */
	markdown?: string | null;
	/** Live editor HTML, when an editor is mounted. */
	html?: string | null;
	/** Canonical TipTap JSON, when already loaded. */
	contentJson?: unknown | null;
}

/**
 * PAGE export surface (`01-ux-spec.md` §10.9, `05-editor-spec.md` §9.1/§9.3):
 * copy as Markdown, download `.md`, and print/PDF.
 *
 * 🛑 **Nothing here imports `@tiptap/*` at module scope.** Spec 05 §12 keeps the
 * whole editor stack behind the `page/:id` route, and this service is used from
 * the *detail panel*, which ships in the browse chunk. The JSON→Markdown path
 * therefore goes through a dynamic `import()` that only fires when a user
 * exports a page whose markdown was not already supplied by a mounted editor —
 * a static import would drag ProseMirror into the browse bundle.
 *
 * Print uses a same-origin hidden iframe rather than `window.open`: a popup
 * blocker silently eating the print window is indistinguishable from a broken
 * button, and an iframe needs no new route (spec 05 §9.1 calls for
 * "static-renderer HTML into a print-styled route + `window.print()`" — the
 * iframe *is* that document, minus the routing).
 */
@Injectable()
export class DocsExportService {
	private readonly documentsService = inject(DocumentsService);
	private readonly sanitizer = inject(DomSanitizer);

	// ─── Markdown ────────────────────────────────────────────────

	/**
	 * Resolves the Markdown body for a document.
	 *
	 * Order: caller-supplied editor markdown → caller-supplied/loaded
	 * `contentJson` through the static renderer → FILE `extractedText`. Returns
	 * an empty string when nothing is resolvable; callers treat that as "nothing
	 * to export" rather than writing an empty file.
	 */
	async resolveMarkdown(document: IDocument, source: IDocsExportSource = {}): Promise<string> {
		if (source.markdown?.trim()) return source.markdown;

		if (document.kind === DocumentKindEnum.PAGE) {
			const contentJson = source.contentJson ?? (await this.loadContent(document.id as ID)).contentJson;
			if (contentJson) {
				const markdown = await this.renderJsonToMarkdown(contentJson);
				if (markdown?.trim()) return markdown;
			}
		}
		return document.extractedText?.trim() ?? '';
	}

	/** Copies the Markdown body to the clipboard. Returns false when there was nothing to copy. */
	async copyMarkdown(document: IDocument, source: IDocsExportSource = {}): Promise<boolean> {
		const markdown = await this.resolveMarkdown(document, source);
		if (!markdown) return false;
		await navigator.clipboard.writeText(markdown);
		return true;
	}

	/** Downloads the Markdown body as `<slug>.md`. Returns false when there was nothing to write. */
	async downloadMarkdown(document: IDocument, source: IDocsExportSource = {}): Promise<boolean> {
		const markdown = await this.resolveMarkdown(document, source);
		if (!markdown) return false;
		// A leading `# <title>` keeps the exported file self-describing: the page
		// title lives in `document.name`, never inside `contentJson`.
		const body = markdown.startsWith('#') ? markdown : `# ${document.name}\n\n${markdown}`;
		this.triggerDownload(new Blob([body], { type: 'text/markdown;charset=utf-8' }), `${this.slug(document.name)}.md`);
		return true;
	}

	// ─── Print / PDF ─────────────────────────────────────────────

	/**
	 * Renders the document into a hidden, print-styled iframe and calls
	 * `print()` on it (the browser's "Save as PDF" is the PDF path in v1 — real
	 * server-side PDF files are M5, spec 05 §16).
	 *
	 * Returns false when there is no renderable body.
	 */
	async print(document: IDocument, source: IDocsExportSource = {}): Promise<boolean> {
		const html = await this.resolveHtml(document, source);
		if (!html) return false;

		const frame = window.document.createElement('iframe');
		// Off-screen rather than `display:none`: a zero-box iframe does not always
		// lay out, and an unlaid-out document prints blank in WebKit.
		frame.setAttribute('aria-hidden', 'true');
		frame.style.position = 'fixed';
		frame.style.right = '0';
		frame.style.bottom = '0';
		frame.style.width = '0';
		frame.style.height = '0';
		frame.style.border = '0';
		frame.style.visibility = 'hidden';
		window.document.body.appendChild(frame);

		const doc = frame.contentDocument;
		if (!doc) {
			frame.remove();
			return false;
		}
		doc.open();
		doc.write(this.printDocument(document, html));
		doc.close();

		const run = () => {
			try {
				frame.contentWindow?.focus();
				frame.contentWindow?.print();
			} finally {
				// Chrome's print dialog is modal to the tab, Firefox's is not — the
				// timeout is the only portable "the dialog has had the frame" signal.
				setTimeout(() => frame.remove(), 1000);
			}
		};
		// `load` may already have fired for a document written synchronously.
		if (doc.readyState === 'complete') setTimeout(run);
		else frame.onload = run;
		return true;
	}

	/**
	 * Resolves the print/render HTML: caller-supplied editor HTML → the server's
	 * sanitized `contentHtml` render cache → static render of `contentJson` →
	 * `extractedText` as preformatted text. Always re-sanitized here, because the
	 * string ends up as `innerHTML` of a same-origin document.
	 */
	async resolveHtml(document: IDocument, source: IDocsExportSource = {}): Promise<string> {
		const direct = source.html ?? document.contentHtml;
		if (direct?.trim()) return this.sanitize(direct);

		if (document.kind === DocumentKindEnum.PAGE) {
			const content = await this.loadContent(document.id as ID);
			if (content.contentHtml?.trim()) return this.sanitize(content.contentHtml);
			const contentJson = source.contentJson ?? content.contentJson;
			if (contentJson) {
				const html = await this.renderJsonToHtml(contentJson);
				if (html?.trim()) return this.sanitize(html);
			}
		}
		if (document.extractedText?.trim()) {
			return `<pre class="gz-print-extracted">${this.escape(document.extractedText)}</pre>`;
		}
		return '';
	}

	// ─── Internals ───────────────────────────────────────────────

	private async loadContent(id: ID): Promise<{ contentJson?: unknown; contentHtml?: string }> {
		return (
			(await firstValueFrom(this.documentsService.getContent(id).pipe(catchError(() => of(null))))) ?? {}
		);
	}

	/** Dynamic import — see the class doc for why this is not a static import. */
	private async renderJsonToMarkdown(contentJson: unknown): Promise<string> {
		try {
			const [{ renderToMarkdown }, { createStaticExtensions }] = await Promise.all([
				import('@tiptap/static-renderer'),
				import('../editor/extensions/document-extensions')
			]);
			return renderToMarkdown({ extensions: createStaticExtensions(), content: contentJson as never });
		} catch {
			return '';
		}
	}

	private async renderJsonToHtml(contentJson: unknown): Promise<string> {
		try {
			const [{ renderToHTMLString }, { createStaticExtensions }] = await Promise.all([
				import('@tiptap/static-renderer'),
				import('../editor/extensions/document-extensions')
			]);
			return renderToHTMLString({ extensions: createStaticExtensions(), content: contentJson as never });
		} catch {
			return '';
		}
	}

	private sanitize(html: string): string {
		return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
	}

	private escape(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	/** Print stylesheet mirrors the editor's reading column (spec 05 §9.1 tier 3). */
	private printDocument(document: IDocument, body: string): string {
		return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${this.escape(document.name)}</title>
<style>
	@page { margin: 18mm 16mm; }
	html, body { margin: 0; padding: 0; background: #fff; color: #1a1a1a; }
	body {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		font-size: 11pt;
		line-height: 1.6;
	}
	.gz-print-title { font-size: 20pt; margin: 0 0 4mm; }
	.gz-print-meta { font-size: 8pt; color: #666; margin: 0 0 8mm; }
	h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; margin: 6mm 0 2mm; }
	p, li { orphans: 3; widows: 3; }
	pre, blockquote, table, figure, img { break-inside: avoid; page-break-inside: avoid; }
	pre { background: #f6f7f9; padding: 3mm; border-radius: 2mm; white-space: pre-wrap; word-break: break-word; }
	code { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 9.5pt; }
	img { max-width: 100%; height: auto; }
	table { border-collapse: collapse; width: 100%; }
	th, td { border: 0.3mm solid #d0d3d8; padding: 1.5mm 2mm; text-align: left; }
	blockquote { margin: 3mm 0; padding-left: 4mm; border-left: 0.8mm solid #d0d3d8; color: #444; }
	a { color: inherit; text-decoration: underline; }
	/* Links print as text — a bare URL in a PDF is noise, the label carries the meaning. */
	a[href]::after { content: ''; }
	ul[data-type='taskList'] { list-style: none; padding-left: 0; }
	hr { border: 0; border-top: 0.3mm solid #d0d3d8; margin: 5mm 0; }
</style>
</head>
<body>
	<h1 class="gz-print-title">${this.escape(document.name)}</h1>
	<div class="gz-print-meta">${this.escape(new Date().toLocaleString())}</div>
	<div class="gz-print-body">${body}</div>
</body>
</html>`;
	}

	private triggerDownload(blob: Blob, filename: string): void {
		const url = URL.createObjectURL(blob);
		const anchor = window.document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		anchor.style.display = 'none';
		window.document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		// Revoking synchronously races the download in Safari.
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	/** Filesystem-safe filename stem; never empty. */
	private slug(name: string): string {
		const cleaned = (name ?? '')
			.normalize('NFKD')
			.replace(/[^\w\s.-]/g, '')
			.trim()
			.replace(/\s+/g, '-')
			.replace(/-{2,}/g, '-');
		return this.trimDotsAndDashes(cleaned).slice(0, 80) || 'document';
	}

	/**
	 * Strips leading and trailing `.`/`-` characters.
	 *
	 * Replaces `/^[.-]+|[.-]+$/g`, whose `[.-]+$` branch retried the trailing-run match from
	 * every position inside the run and so cost O(n²) on a name made of dots (dots survive the
	 * character filter above, and unlike dashes they are not collapsed by the `-{2,}` pass).
	 * Two index walks touch each character at most once.
	 */
	private trimDotsAndDashes(value: string): string {
		const isTrimmable = (char: string) => char === '.' || char === '-';
		let start = 0;
		let end = value.length;
		while (start < end && isTrimmable(value[start])) start++;
		while (end > start && isTrimmable(value[end - 1])) end--;
		return value.slice(start, end);
	}
}
