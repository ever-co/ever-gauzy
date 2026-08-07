/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core — importing it pulls
 * Akita's untranspiled ESM into the CommonJS test runtime. The service only ever
 * reads `Store.selectedOrganization`, so a stub standing in for it keeps the
 * suite honest without booting the app graph.
 */
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));

import { HttpErrorResponse, HttpEventType, HttpParams, HttpResponse } from '@angular/common/http';
import { firstValueFrom, Observable, of } from 'rxjs';
import { DocumentKindEnum, ID, IDocument } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { DocumentsService } from './documents.service';

const ORGANIZATION_ID = 'aaaaaaaa-1111-4111-8111-111111111111' as ID;
const TENANT_ID = 'aaaaaaaa-2222-4222-8222-222222222222' as ID;
const DOCUMENT_ID = 'aaaaaaaa-3333-4333-8333-333333333333' as ID;

interface RecordedRequest {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	url: string;
	body?: unknown;
	options?: { params?: HttpParams };
}

/**
 * Minimal `HttpClient` double. Instantiating the service directly (rather than
 * through `TestBed`) keeps the suite free of the Angular testing module while
 * still exercising the real `toParams()` serialization.
 */
class HttpClientStub {
	public readonly requests: RecordedRequest[] = [];
	public response: unknown = null;

	get(url: string, options?: { params?: HttpParams }): Observable<unknown> {
		this.requests.push({ method: 'GET', url, options });
		return of(this.response);
	}

	post(url: string, body: unknown, options?: { params?: HttpParams }): Observable<unknown> {
		this.requests.push({ method: 'POST', url, body, options });
		return of(this.response);
	}

	put(url: string, body: unknown): Observable<unknown> {
		this.requests.push({ method: 'PUT', url, body });
		return of(this.response);
	}

	delete(url: string, options?: { params?: HttpParams }): Observable<unknown> {
		this.requests.push({ method: 'DELETE', url, options });
		return of(this.response);
	}

	/** The last recorded request — every test issues exactly one. */
	get last(): RecordedRequest {
		return this.requests[this.requests.length - 1];
	}

	get params(): HttpParams {
		return this.last.options?.params ?? new HttpParams();
	}
}

const documentFixture = (overrides: Partial<IDocument> = {}): IDocument =>
	({ id: DOCUMENT_ID, name: 'invoice.pdf', kind: DocumentKindEnum.FILE, ...overrides } as IDocument);

/** The 201 body of the upload endpoint, wrapped in the event the service maps over. */
const uploadResponse = (body: unknown) => new HttpResponse({ body, status: 201, statusText: 'Created' });

describe('DocumentsService — backend wire contract', () => {
	let http: HttpClientStub;
	let service: DocumentsService;

	beforeEach(() => {
		http = new HttpClientStub();
		const store = { selectedOrganization: { id: ORGANIZATION_ID, tenantId: TENANT_ID } } as unknown as Store;
		service = new DocumentsService(http as never, store);
	});

	describe('getAll', () => {
		it('sends only params GetDocumentsQueryDTO declares, in the shapes it accepts', () => {
			http.response = { items: [], total: 0 };

			service
				.getAll({ archived: false, kind: [DocumentKindEnum.PAGE], sort: 'updatedAt:desc', take: 10 })
				.subscribe();

			expect(http.last.url).toMatch(/\/plugins\/docs\/documents$/);
			expect(http.params.get('archived')).toBe('exclude');
			expect(http.params.get('kind')).toBe(DocumentKindEnum.PAGE);
			expect(http.params.get('sort')).toBe('updatedAt');
			expect(http.params.get('sortOrder')).toBe('DESC');
			// The organization scope rides in `where`; a top-level one is whitelisted away.
			expect(http.params.get('where[organizationId]')).toBe(ORGANIZATION_ID);
			expect(http.params.get('organizationId')).toBeNull();
		});

		it('defaults the organization scope from the selected organization', () => {
			http.response = { items: [], total: 0 };

			service.getAll().subscribe();

			expect(http.params.get('where[organizationId]')).toBe(ORGANIZATION_ID);
			expect(http.params.get('where[tenantId]')).toBe(TENANT_ID);
		});

		it('never serializes an absent filter as the string "undefined"', () => {
			http.response = { items: [], total: 0 };

			service.getAll({ status: [], q: '' }).subscribe();

			expect(http.params.keys()).toEqual(['where[organizationId]', 'where[tenantId]']);
		});
	});

	describe('upload', () => {
		it('posts the multipart field the interceptor binds (`files`, not `file`)', () => {
			http.response = uploadResponse({ results: [{ document: documentFixture() }], rejected: [] });

			service.upload(new File(['x'], 'invoice.pdf'), { importToKnowledge: true }).subscribe();

			expect(http.last.url).toMatch(/\/documents\/upload$/);
			const body = http.last.body as FormData;
			expect(body.getAll('files').length).toBe(1);
			expect(body.get('file')).toBeNull();
			expect(body.get('importToKnowledge')).toBe('true');
			// `UploadDocumentsDTO` requires an organization; the dialogs do not carry one.
			expect(body.get('organizationId')).toBe(ORGANIZATION_ID);
		});

		it('never sends `classifyWithAi` — the upload DTO has no such field', () => {
			http.response = uploadResponse({ results: [{ document: documentFixture() }], rejected: [] });

			service.upload(new File(['x'], 'a.pdf'), { classifyWithAi: false }).subscribe();

			expect((http.last.body as FormData).get('classifyWithAi')).toBeNull();
		});

		it('unwraps the `{ results, rejected }` envelope into the accepted document', async () => {
			http.response = uploadResponse({ results: [{ document: documentFixture() }], rejected: [] });

			const event = await firstValueFrom(service.upload(new File(['x'], 'a.pdf'), {}));

			expect(event.type).toBe(HttpEventType.Response);
			expect((event as HttpResponse<IDocument>).body).toEqual(documentFixture());
		});

		it('turns a per-file rejection into an error instead of an undefined document', async () => {
			// The batch endpoint answers 201 even when it accepted nothing.
			http.response = uploadResponse({
				results: [],
				rejected: [{ fileName: 'a.exe', code: 'DOCS_FILE_TYPE_REJECTED', message: 'not allowed' }]
			});

			await expect(firstValueFrom(service.upload(new File(['x'], 'a.exe'), {}))).rejects.toMatchObject({
				error: { code: 'DOCS_FILE_TYPE_REJECTED' }
			});
		});

		it('passes progress events through untouched', async () => {
			http.response = { type: HttpEventType.UploadProgress, loaded: 5, total: 10 };

			const event = await firstValueFrom(service.upload(new File(['x'], 'a.pdf'), {}));

			expect(event).toEqual({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
		});
	});

	describe('getLinks', () => {
		it('unwraps the pagination envelope the endpoint actually returns', async () => {
			http.response = { items: [{ id: 'link-1' }], total: 1 };

			await expect(firstValueFrom(service.getLinks(DOCUMENT_ID))).resolves.toEqual([{ id: 'link-1' }]);
			expect(http.last.url).toMatch(/\/documents\/.+\/links$/);
		});
	});

	describe('getContent', () => {
		it('reads the content off the document — there is no GET /:id/content route', async () => {
			http.response = documentFixture({ contentJson: { type: 'doc' }, contentHtml: '<p>hi</p>' } as never);

			const content = await firstValueFrom(service.getContent(DOCUMENT_ID));

			expect(content).toEqual({ contentJson: { type: 'doc' }, contentHtml: '<p>hi</p>' });
			expect(http.last.method).toBe('GET');
			expect(http.last.url).toMatch(/\/documents\/[^/]+$/);
			expect(http.last.url).not.toMatch(/\/content$/);
		});
	});

	describe('bulk', () => {
		it('strips the organization scope BulkDocumentActionDTO forbids', () => {
			http.response = { requested: 1, succeeded: 1, failed: 0, results: [] };

			service
				.bulk({ action: 'ARCHIVE', ids: [DOCUMENT_ID], organizationId: ORGANIZATION_ID, tenantId: TENANT_ID })
				.subscribe();

			expect(http.last.body).toEqual({ action: 'ARCHIVE', ids: [DOCUMENT_ID] });
		});
	});

	describe('getDownloadUrl', () => {
		it('resolves the provider URL through the authenticated client', async () => {
			http.response = { url: 'https://files.example/doc.pdf' };

			await expect(firstValueFrom(service.getDownloadUrl(DOCUMENT_ID))).resolves.toBe(
				'https://files.example/doc.pdf'
			);
			expect(http.last.url).toMatch(/\/documents\/.+\/download$/);
		});
	});

	describe('HttpErrorResponse', () => {
		it('is what a rejection surfaces as, so the upload queue can classify it', async () => {
			http.response = uploadResponse({ results: [], rejected: [] });

			const error = await firstValueFrom(service.upload(new File(['x'], 'a.pdf'), {})).catch((thrown) => thrown);

			expect(error).toBeInstanceOf(HttpErrorResponse);
			expect(error.error.code).toBe('DOCS_UPLOAD_REJECTED');
		});
	});
});
