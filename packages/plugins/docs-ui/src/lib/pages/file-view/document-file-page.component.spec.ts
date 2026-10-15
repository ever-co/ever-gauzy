import { convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { DocumentKindEnum, IDocument } from '@gauzy/contracts';
import { DocumentsActions } from '../../+state/documents.actions';
import { DocumentFilePageComponent } from './document-file-page.component';

/**
 * The full-width file page follows what the rest of the app does to the file it shows (review on #10642): the
 * header's organization, a load still in flight when the viewer leaves, and edits / deletion made in the details
 * column. The component runs as the router runs it, with its collaborators scripted.
 */
describe('DocumentFilePageComponent', () => {
	const ORG_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
	const ORG_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
	const FILE: IDocument = { id: 'f1', name: 'Q3 report.csv', kind: DocumentKindEnum.FILE, organizationId: ORG_A } as IDocument;

	let paramMap$: BehaviorSubject<ParamMap>;
	let organization$: BehaviorSubject<{ id: string }>;
	let actions$: Subject<any>;
	let loads: Subject<IDocument>[];
	let router: { navigate: jest.Mock };
	let page: DocumentFilePageComponent;

	/** Answers the oldest pending load. */
	const answer = (document: IDocument) => {
		const load = loads.shift();
		load.next(document);
		load.complete();
	};
	const fail = (status: number) => loads.shift().error({ status });
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	beforeEach(() => {
		paramMap$ = new BehaviorSubject(convertToParamMap({ id: FILE.id }));
		organization$ = new BehaviorSubject({ id: ORG_A });
		actions$ = new Subject();
		loads = [];
		router = { navigate: jest.fn(async () => true) };
		const documentsService = {
			getById: jest.fn(() => {
				const load = new Subject<IDocument>();
				loads.push(load);
				return load;
			})
		};
		page = new DocumentFilePageComponent(
			{ instant: (key: string) => key } as any,
			{ paramMap: paramMap$ } as any,
			router as any,
			documentsService as any,
			{ selectedOrganization$: organization$ } as any,
			actions$ as any
		);
		page.ngOnInit();
	});

	afterEach(() => page.ngOnDestroy());

	it('shows the file, full width', async () => {
		answer(FILE);
		await settle();

		expect(page.state).toBe('ready');
		expect(page.document).toEqual(FILE);
	});

	it('reloads when the header switches organization, and does not show a file of another one', async () => {
		answer(FILE);
		await settle();

		organization$.next({ id: ORG_B });
		answer(FILE); // the API answered the same row: it belongs to organization A
		await settle();

		expect(page.document).toBeNull();
		expect(page.state).toBe('not-found');
	});

	it('drops a load that comes back after the viewer left — no redirect pulls them back', async () => {
		page.ngOnDestroy();
		answer({ ...FILE, kind: DocumentKindEnum.PAGE });
		await settle();

		expect(router.navigate).not.toHaveBeenCalled();
		expect(page.document).toBeNull();
	});

	it('rebuilds the preview from a row edited in the details column', async () => {
		answer(FILE);
		await settle();
		const revision = page.previewRevision;

		actions$.next(DocumentsActions.rowChanged({ ...FILE, name: 'Q3 report (final).csv' } as IDocument));
		actions$.next(DocumentsActions.rowChanged({ id: 'other', name: 'Other' } as IDocument));

		expect(page.document.name).toBe('Q3 report (final).csv');
		expect(page.previewRevision).toBe(revision + 1);
	});

	it('goes back to the documents list when the file is deleted', async () => {
		answer(FILE);
		await settle();

		actions$.next(DocumentsActions.rowRemoved('other'));
		expect(router.navigate).not.toHaveBeenCalled();

		actions$.next(DocumentsActions.rowRemoved(FILE.id));
		expect(router.navigate).toHaveBeenCalledWith(['/pages/documents'], { replaceUrl: true });
		expect(page.document).toBeNull();
	});

	it('forwards a page to the editor and a folder to the hub', async () => {
		answer({ ...FILE, kind: DocumentKindEnum.PAGE });
		await settle();
		expect(router.navigate).toHaveBeenLastCalledWith(['/pages/documents/page', FILE.id], {
			queryParams: { view: 'full' },
			replaceUrl: true
		});

		paramMap$.next(convertToParamMap({ id: 'folder-1' }));
		answer({ ...FILE, id: 'folder-1', kind: DocumentKindEnum.FOLDER });
		await settle();
		expect(router.navigate).toHaveBeenLastCalledWith(['/pages/documents'], {
			queryParams: { folder: 'folder-1' },
			replaceUrl: true
		});
	});

	it('states not found / no permission for a refused load', async () => {
		fail(404);
		await settle();
		expect(page.state).toBe('not-found');

		paramMap$.next(convertToParamMap({ id: 'f2' }));
		fail(403);
		await settle();
		expect(page.state).toBe('forbidden');
	});
});
