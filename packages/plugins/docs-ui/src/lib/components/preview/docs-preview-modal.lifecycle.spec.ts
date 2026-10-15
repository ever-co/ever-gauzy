/*
 * The PDF viewer reaches pdfjs through `import.meta.url`, which the CommonJS test runtime cannot load; this spec never
 * renders it (as favorite-links.routes.spec.ts does).
 */
jest.mock('./pdf-viewer.component', () => {
	const { Component } = jest.requireActual('@angular/core');
	@Component({ selector: 'gz-docs-pdf-viewer', template: '', standalone: false })
	class PdfViewerComponent {}
	return { PdfViewerComponent };
});

import { Subject } from 'rxjs';
import { DocumentKindEnum, IDocument } from '@gauzy/contracts';
import { DocsPreviewModalComponent } from './docs-preview-modal.component';

/**
 * The preview downloads a PDF / image / media file into an object URL. When it is destroyed while that download is
 * still running — the full-width file page rebuilds it after an edit (review on #10642) — the late answer must not
 * create a URL nobody revokes: the bytes would stay in browser memory for the life of the tab.
 */
describe('DocsPreviewModalComponent — a download that finishes after the preview is gone', () => {
	const PDF: IDocument = { id: 'p1', name: 'spec.pdf', kind: DocumentKindEnum.FILE, mimeType: 'application/pdf' } as IDocument;

	let createObjectURL: jest.Mock;
	let revokeObjectURL: jest.Mock;
	let blob$: Subject<Blob>;
	let preview: DocsPreviewModalComponent;

	beforeEach(() => {
		createObjectURL = jest.fn(() => 'blob:http://localhost/1');
		revokeObjectURL = jest.fn();
		Object.assign(URL, { createObjectURL, revokeObjectURL });
		blob$ = new Subject<Blob>();
		preview = new DocsPreviewModalComponent(
			{ instant: (key: string) => key } as any,
			null,
			{ getRawBlob: jest.fn(() => blob$) } as any,
			{} as any,
			{ dispatch: jest.fn() } as any,
			{ nativeElement: document.createElement('div') } as any
		);
		preview.document = PDF;
		preview.inline = true;
	});

	it('creates no object URL once destroyed', async () => {
		preview.ngOnInit();
		preview.ngOnDestroy();

		blob$.next(new Blob(['%PDF-1.7']));
		blob$.complete();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(createObjectURL).not.toHaveBeenCalled();
	});

	it('still serves the file while it is shown, and releases it when destroyed', async () => {
		preview.ngOnInit();
		blob$.next(new Blob(['%PDF-1.7']));
		blob$.complete();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(createObjectURL).toHaveBeenCalledTimes(1);

		preview.ngOnDestroy();
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/1');
	});
});
