/**
 * The import dialog's flow, driven through the class (no TestBed): the target it sends, upload progress, polling
 * until the import is over, the report groups, and the refusal codes it shows. `@gauzy/ui-core/*` barrels pull the
 * whole app core, so the two pieces the dialog uses are stubbed.
 */
jest.mock('@gauzy/ui-core/i18n', () => ({
	TranslationBaseComponent: class {
		constructor(public translateService: unknown) {}
		getTranslation(key: string): string {
			return key;
		}
	}
}));
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));
jest.mock('@gauzy/ui-core/common', () => ({ API_PREFIX: '/api', toParams: (value: unknown) => value }));

import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';
import { Injector, runInInjectionContext, DestroyRef } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import {
	DocumentImportItemStatusEnum,
	DocumentImportPhaseEnum,
	DocumentImportStatusEnum,
	DocumentKindEnum,
	DocumentSpaceKindEnum,
	DocumentVisibilityEnum,
	IDocumentImport
} from '@gauzy/contracts';
import { DocsImportDialogComponent } from './docs-import-dialog.component';

const running = (processed: number): IDocumentImport =>
	({ id: 'import-1', status: DocumentImportStatusEnum.RUNNING, phase: DocumentImportPhaseEnum.TREE, processedItems: processed, totalItems: 10 } as IDocumentImport);

function build(spaces$ = of([{ kind: DocumentSpaceKindEnum.ORGANIZATION }, { kind: DocumentSpaceKindEnum.TEAM, organizationTeamId: 'team-1', name: 'API' }] as never)) {
	const destroy = new Subject<void>();
	const destroyRef = { onDestroy: (callback: () => void) => destroy.subscribe(callback) } as unknown as DestroyRef;
	const injector = Injector.create({ providers: [{ provide: DestroyRef, useValue: destroyRef }] });
	const dialogRef = { close: jest.fn() };
	const importService = { start: jest.fn(), get: jest.fn(), refreshImportProbe: jest.fn() };
	const documentsService = { getSpaces: jest.fn(() => spaces$) };
	const cdr = { markForCheck: jest.fn() };
	const component = runInInjectionContext(
		injector,
		() => new DocsImportDialogComponent({} as never, dialogRef as never, importService as never, documentsService as never, cdr as never)
	);
	return { component, dialogRef, importService, destroy };
}

const zip = (name = 'vault.zip', size = 10) => {
	const file = new File(['x'.repeat(size)], name, { type: name.endsWith('.zip') ? 'application/zip' : 'text/markdown' });
	return { target: { files: [file] } } as unknown as Event;
};

describe('DocsImportDialogComponent', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it('defaults to the current folder, else to the organization space', () => {
		const inFolder = build();
		inFolder.component.parentId = 'folder-1';
		inFolder.component.ngOnInit();
		expect(inFolder.component.targetKey).toBe('parent');

		const atTop = build();
		atTop.component.ngOnInit();
		expect(atTop.component.spaces).toHaveLength(2);
		expect(atTop.component.targetKey).not.toBe('');
	});

	it('offers the organization and private spaces when the spaces route answers 404', () => {
		const { component } = build(throwError(() => new HttpErrorResponse({ status: 404 })) as never);
		component.ngOnInit();
		expect(component.spaces.map((space) => space.kind)).toEqual([DocumentSpaceKindEnum.ORGANIZATION, DocumentSpaceKindEnum.PRIVATE]);
	});

	it('refuses a file that is not a zip, or over the limit, before uploading', () => {
		const { component } = build();
		component.maxZipBytes = 5;
		component.ngOnInit();
		component.onFile(zip('notes.md'));
		expect(component.fileError).toBe('DOCS.IMPORT.ERROR.NOT_A_ZIP');
		component.onFile(zip('vault.zip', 10));
		expect(component.fileError).toBe('DOCS.IMPORT.ERROR.TOO_LARGE');
	});

	it('uploads into the chosen team space, then polls until the import is done and shows the report', () => {
		const { component, importService } = build();
		component.ngOnInit();
		component.targetKey = component.key(component.spaces[1]);
		component.onFile(zip());
		const events = new Subject<any>();
		importService.start.mockReturnValue(events);
		const reads = [running(4), { ...running(10), status: DocumentImportStatusEnum.COMPLETED, phase: DocumentImportPhaseEnum.DONE, importedCount: 2, report: { items: [{ path: 'V/Home.md', kind: DocumentKindEnum.PAGE, status: DocumentImportItemStatusEnum.IMPORTED, documentId: 'page-1', name: 'Home' }, { path: 'V/a.exe', kind: DocumentKindEnum.FILE, status: DocumentImportItemStatusEnum.SKIPPED, reason: 'UNSUPPORTED_TYPE' }] } }];
		importService.get.mockImplementation(() => of(reads.shift()));

		component.startImport();
		expect(importService.start).toHaveBeenCalledWith(expect.any(File), { visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: 'team-1' });
		expect(component.step).toBe('uploading');
		events.next({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
		expect(component.uploadPercent).toBe(50);
		events.next(new HttpResponse({ body: running(0) }));
		expect(component.step).toBe('running');
		expect(importService.refreshImportProbe).toHaveBeenCalled();

		jest.advanceTimersByTime(1500);
		expect(component.progress).toBe(40);
		jest.advanceTimersByTime(1500);
		expect(component.step).toBe('done');
		expect(component.groups.pages.map((item) => item.documentId)).toEqual(['page-1']);
		expect(component.notImported.map((item) => item.reason)).toEqual(['UNSUPPORTED_TYPE']);
		jest.advanceTimersByTime(6000);
		expect(importService.get).toHaveBeenCalledTimes(2);
	});

	it('goes back to the picker with the reason when the server refuses the zip', () => {
		const { component, importService } = build();
		component.ngOnInit();
		component.onFile(zip());
		importService.start.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'DOCS_IMPORT_SYMLINK' } })));
		component.startImport();
		expect(component.step).toBe('pick');
		expect(component.fileError).toBe('DOCS.IMPORT.ERROR.SYMLINK');
	});

	it('closes with the page picked in the report', () => {
		const { component, dialogRef } = build();
		component.current = running(1);
		component.openPage({ preventDefault: jest.fn() } as unknown as Event, { path: 'V/Home.md', documentId: 'page-1' } as never);
		expect(dialogRef.close).toHaveBeenCalledWith({ import: component.current, openPageId: 'page-1' });
	});
});
