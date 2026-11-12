/**
 * The import run (`docs-import-export` spec FR-17) is the opener's, so it outlives the dialog: one read of the import at
 * a time, a failed read that does not stop the polling, a refusal for good that does, a retry without a new upload, the
 * end told once, and a refused upload kept apart from the dialog's check of the file.
 */
import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';
import { NEVER, Observable, of, Subject, throwError, timer, map } from 'rxjs';
import { DocumentImportPhaseEnum, DocumentImportStatusEnum, DocumentVisibilityEnum, IDocumentImport } from '@gauzy/contracts';
import { DOCS_IMPORT_READ_TIMEOUT_MS, DOCS_IMPORT_TRACKING_FAILURES, DocsImportRun } from './docs-import-run';

const running = (processed: number): IDocumentImport =>
	({ id: 'import-1', status: DocumentImportStatusEnum.RUNNING, phase: DocumentImportPhaseEnum.TREE, processedItems: processed, totalItems: 10 }) as IDocumentImport;
const completed = (): IDocumentImport =>
	({ ...running(10), status: DocumentImportStatusEnum.COMPLETED, phase: DocumentImportPhaseEnum.DONE, importedCount: 4 }) as IDocumentImport;

function build() {
	const client = { start: jest.fn(), get: jest.fn(), refreshImportProbe: jest.fn() };
	const onFinished = jest.fn();
	const run = new DocsImportRun(client, onFinished);
	const changes = jest.fn();
	run.changes$.subscribe(changes);
	return { run, client, onFinished, changes };
}

const zip = () => new File(['zip'], 'vault.zip', { type: 'application/zip' });
const TARGET = { visibility: DocumentVisibilityEnum.ORGANIZATION };

/** Starts a run whose upload answers `started`. */
function started(run: DocsImportRun, client: ReturnType<typeof build>['client'], value: IDocumentImport) {
	client.start.mockReturnValue(of(new HttpResponse({ body: value })));
	run.start(zip(), TARGET);
}

describe('DocsImportRun', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it('uploads with progress, follows the import to its end and tells it once', () => {
		const { run, client, onFinished } = build();
		const events = new Subject<any>();
		client.start.mockReturnValue(events);
		client.get.mockReturnValueOnce(of(running(4))).mockReturnValue(of(completed()));

		run.start(zip(), TARGET);
		expect(run.inProgress).toBe(true);
		events.next({ type: HttpEventType.UploadProgress, loaded: 3, total: 4 });
		expect(run.uploadPercent).toBe(75);
		events.next(new HttpResponse({ body: running(0) }));
		expect(run.step).toBe('running');
		expect(client.refreshImportProbe).toHaveBeenCalled();

		jest.advanceTimersByTime(1500);
		expect(run.current?.processedItems).toBe(4);
		jest.advanceTimersByTime(1500);
		expect(run.step).toBe('done');
		expect(run.inProgress).toBe(false);
		jest.advanceTimersByTime(6000);
		expect(client.get).toHaveBeenCalledTimes(2);
		expect(onFinished).toHaveBeenCalledTimes(1);
		expect(onFinished).toHaveBeenCalledWith(expect.objectContaining({ importedCount: 4 }));
	});

	it('lets a slow read finish instead of cutting it at the next tick', () => {
		const { run, client } = build();
		// Every read takes 4 s, longer than the 1.5 s between ticks.
		client.get.mockImplementation((): Observable<IDocumentImport> => timer(4000).pipe(map(() => completed())));
		started(run, client, running(0));

		jest.advanceTimersByTime(1500 + 4000);
		expect(run.step).toBe('done');
		expect(client.get).toHaveBeenCalledTimes(1);
	});

	it('keeps polling through failed reads, says so after a few, and recovers', () => {
		const { run, client } = build();
		client.get.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
		started(run, client, running(1));

		jest.advanceTimersByTime(1500 * (DOCS_IMPORT_TRACKING_FAILURES - 1));
		expect(run.trackingError).toBe(false);
		jest.advanceTimersByTime(1500);
		expect(run.trackingError).toBe(true);

		client.get.mockReturnValue(of(completed()));
		jest.advanceTimersByTime(1500);
		expect(run.trackingError).toBe(false);
		expect(run.step).toBe('done');
	});

	it('stops polling an import the server no longer answers for, and reads it again on demand', () => {
		const { run, client, onFinished } = build();
		client.get.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
		started(run, client, running(1));

		jest.advanceTimersByTime(1500);
		expect(run.trackingError).toBe(true);
		jest.advanceTimersByTime(15000);
		expect(client.get).toHaveBeenCalledTimes(1);
		// Nothing runs here any more: closing the dialog puts the run away.
		expect(run.inProgress).toBe(false);

		client.get.mockReturnValue(of(completed()));
		run.retryRead();
		jest.advanceTimersByTime(0);
		expect(run.step).toBe('done');
		expect(client.start).toHaveBeenCalledTimes(1);
		expect(onFinished).toHaveBeenCalledTimes(1);
	});

	it('counts a read that never answers as a failed one', () => {
		const { run, client } = build();
		client.get.mockReturnValue(NEVER);
		started(run, client, running(1));

		jest.advanceTimersByTime(1500 + DOCS_IMPORT_TRACKING_FAILURES * (DOCS_IMPORT_READ_TIMEOUT_MS + 1500));
		expect(run.trackingError).toBe(true);
		expect(client.get.mock.calls.length).toBeGreaterThanOrEqual(DOCS_IMPORT_TRACKING_FAILURES);
	});

	it('goes back to the picker when the upload answers without the import', () => {
		const { run, client } = build();
		client.start.mockReturnValue(of(new HttpResponse<IDocumentImport>({ body: null })));
		run.start(zip(), TARGET);
		expect(run).toMatchObject({ step: 'pick', requestError: 'DOCS.IMPORT.ERROR.FAILED', inProgress: false });
		run.clearRequestError();
		expect(run.requestError).toBeNull();
	});

	it('keeps a refused upload apart, so Start can be pressed again', () => {
		const { run, client } = build();
		client.start.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'DOCS_IMPORT_ZIP_BOMB' } })));
		run.start(zip(), TARGET);
		expect(run).toMatchObject({ step: 'pick', requestError: 'DOCS.IMPORT.ERROR.ZIP_BOMB', inProgress: false });

		client.start.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 413 })));
		run.start(zip(), TARGET);
		expect(run.requestError).toBe('DOCS.IMPORT.ERROR.TOO_LARGE');
	});

	it('drops an upload that answers after the run was put away (an organization switch)', () => {
		const { run, client, onFinished } = build();
		const events = new Subject<any>();
		client.start.mockReturnValue(events);
		run.start(zip(), TARGET);
		run.reset();
		expect(events.observed).toBe(false);
		events.next(new HttpResponse({ body: running(1) }));
		expect(run).toMatchObject({ step: 'pick', current: null });
		expect(onFinished).not.toHaveBeenCalled();
	});

	it('forgets a finished run, and stops its requests with its owner', () => {
		const { run, client } = build();
		client.get.mockReturnValue(of(running(2)));
		started(run, client, running(1));
		run.dispose();
		jest.advanceTimersByTime(6000);
		expect(client.get).not.toHaveBeenCalled();

		const other = build();
		started(other.run, other.client, completed());
		other.run.reset();
		expect(other.run).toMatchObject({ step: 'pick', current: null, requestError: null, trackingError: false });
	});
});
