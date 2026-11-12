import { HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, Subject, Subscription, catchError, exhaustMap, map, of, timeout, timer } from 'rxjs';
import { DocumentVisibilityEnum, ID, IDocumentImport } from '@gauzy/contracts';
import { DOCS_IMPORT_POLL_MS, errorKeyOf, isImportFinished } from './docs-import.model';

/** The step an import run is at. */
export type DocsImportStep = 'pick' | 'uploading' | 'running' | 'done';

/** Where an import lands: under a page or folder, or at the top of a space (`DocsImportService.start`'s target). */
export interface IDocsImportRunTarget {
	parentId?: ID | null;
	visibility?: DocumentVisibilityEnum;
	organizationTeamId?: ID | null;
}

/** What a run needs of `DocsImportService`. */
export interface IDocsImportRunClient {
	start(file: File, target: IDocsImportRunTarget): Observable<HttpEvent<IDocumentImport>>;
	get(id: ID): Observable<IDocumentImport>;
	refreshImportProbe(): void;
}

/** Failed reads in a row after which the dialog says the progress cannot be read (polling goes on). */
export const DOCS_IMPORT_TRACKING_FAILURES = 3;

/** How long one read of the import may take: a read that never answers counts as a failed one. */
export const DOCS_IMPORT_READ_TIMEOUT_MS = 20_000;

/** A read refused for good: the import is gone, or not the reader's any more. Polling stops. */
const isPermanentRefusal = (error: unknown): boolean => [401, 403, 404].includes((error as HttpErrorResponse | null)?.status ?? 0);

/**
 * One import, from the upload to the report, owned by the page that opens the import dialog, not by the dialog: closing
 * the dialog while a zip uploads or an import runs keeps the run, and the dialog opened again shows its progress or its
 * report. `onFinished` is called once per import, when it is over, whether a dialog shows it or not.
 *
 * The import is read every {@link DOCS_IMPORT_POLL_MS}, one read at a time (a slow read is never cut by the next tick).
 * A failed read does not stop the polling; after {@link DOCS_IMPORT_TRACKING_FAILURES} in a row, or a refusal for good
 * (which stops it), `trackingError` is set and `retryRead` reads the same import again without a new upload. A zip the
 * server refuses (or an upload that fails) is `requestError`, apart from the dialog's own check of the file.
 */
export class DocsImportRun {
	public step: DocsImportStep = 'pick';
	public uploadPercent = 0;
	public current: IDocumentImport | null = null;
	/** The message key of a refused or failed upload: the file stays chosen, and Start can be pressed again. */
	public requestError: string | null = null;
	/** The progress could not be read for a while (or was refused for good). */
	public trackingError = false;
	/** The read was refused for good (the import is gone, or not the reader's): nothing runs here any more. */
	public refused = false;

	private readonly changed = new Subject<void>();
	/** Emits on every change, for the view to check. */
	public readonly changes$ = this.changed.asObservable();

	private upload?: Subscription;
	private poll?: Subscription;
	private failures = 0;
	private notifiedId: ID | null = null;

	constructor(
		private readonly client: IDocsImportRunClient,
		private readonly onFinished: (finished: IDocumentImport) => void = () => undefined
	) {}

	/** An upload, or an import that is not over yet (and still readable): closing the dialog keeps it. */
	get inProgress(): boolean {
		return this.step === 'uploading' || (this.step === 'running' && !this.refused);
	}

	/** Uploads the zip and follows the import it starts. */
	start(file: File, target: IDocsImportRunTarget): void {
		if (this.inProgress) return;
		this.stop();
		this.step = 'uploading';
		this.uploadPercent = 0;
		this.requestError = null;
		this.trackingError = false;
		this.refused = false;
		this.emit();
		this.upload = this.client.start(file, target).subscribe({
			next: (event) => {
				if (event.type === HttpEventType.UploadProgress) {
					this.uploadPercent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
					this.emit();
				} else if (event.type === HttpEventType.Response) {
					if (!event.body) {
						// An answer without the import (a proxy in between, say): nothing to follow, Start can be pressed again.
						this.step = 'pick';
						this.requestError = errorKeyOf(null);
						this.emit();
						return;
					}
					this.client.refreshImportProbe();
					this.follow(event.body);
				}
			},
			error: (error: HttpErrorResponse) => {
				this.step = 'pick';
				this.requestError = errorKeyOf(error?.error?.code ?? (error?.status === 413 ? 'DOCS_IMPORT_TOO_LARGE' : null));
				this.emit();
			}
		});
	}

	/** Forgets the refusal of an earlier upload (another file was chosen). */
	clearRequestError(): void {
		if (!this.requestError) return;
		this.requestError = null;
		this.emit();
	}

	/** Reads the running import again, at once and then on the usual interval (the zip is not sent again). */
	retryRead(): void {
		if (this.step !== 'running' || !this.current) return;
		this.trackingError = false;
		this.refused = false;
		this.failures = 0;
		this.emit();
		this.follow(this.current, 0);
	}

	/**
	 * Forgets the run, for the dialog's next opening to start afresh (an upload under way is cancelled: its answer would
	 * belong to a run that is gone, another organization's when the page resets it on a switch).
	 */
	reset(): void {
		this.stop();
		this.step = 'pick';
		this.uploadPercent = 0;
		this.current = null;
		this.requestError = null;
		this.trackingError = false;
		this.refused = false;
		this.failures = 0;
		this.emit();
	}

	/** Stops every request of the run (its owner goes away). */
	dispose(): void {
		this.stop();
		this.changed.complete();
	}

	/** Shows the import and reads it again until it is over. */
	private follow(started: IDocumentImport, firstReadAfter = DOCS_IMPORT_POLL_MS): void {
		this.poll?.unsubscribe();
		this.show(started);
		if (isImportFinished(started)) return;
		this.poll = timer(firstReadAfter, DOCS_IMPORT_POLL_MS)
			.pipe(
				exhaustMap(() =>
					this.client.get(started.id as ID).pipe(
						timeout(DOCS_IMPORT_READ_TIMEOUT_MS),
						map((value) => ({ value, error: null as unknown })),
						catchError((error: unknown) => of({ value: null as IDocumentImport | null, error }))
					)
				)
			)
			.subscribe(({ value, error }) => {
				if (value) {
					this.failures = 0;
					this.trackingError = false;
					this.show(value);
					return;
				}
				this.failures += 1;
				const permanent = isPermanentRefusal(error);
				if (permanent) {
					this.refused = true;
					this.poll?.unsubscribe();
				}
				if (permanent || this.failures >= DOCS_IMPORT_TRACKING_FAILURES) {
					this.trackingError = true;
					this.emit();
				}
			});
	}

	private show(value: IDocumentImport): void {
		this.current = value;
		this.step = isImportFinished(value) ? 'done' : 'running';
		if (this.step === 'done') {
			this.poll?.unsubscribe();
			if (value.id && this.notifiedId !== value.id) {
				this.notifiedId = value.id as ID;
				this.onFinished(value);
			}
		}
		this.emit();
	}

	private stop(): void {
		this.upload?.unsubscribe();
		this.poll?.unsubscribe();
		this.upload = undefined;
		this.poll = undefined;
	}

	private emit(): void {
		this.changed.next();
	}
}
