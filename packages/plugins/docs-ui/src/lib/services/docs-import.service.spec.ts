/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core (Akita's untranspiled ESM): the service only reads
 * `Store.selectedOrganization`, so a stub stands in for it.
 */
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));

import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { DocumentVisibilityEnum, ID } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { DocsImportService } from './docs-import.service';

const ORGANIZATION_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const PAGE_ID = 'aaaaaaaa-3333-4333-8333-333333333333' as ID;

class HttpStub {
	requests: { method: string; url: string; body?: unknown; options?: any }[] = [];
	responses: (unknown | Error)[] = [];
	private next(): Observable<unknown> {
		const response = this.responses.shift();
		return response instanceof Error || response instanceof HttpErrorResponse ? throwError(() => response) : of(response);
	}
	get(url: string, options?: any): Observable<unknown> {
		this.requests.push({ method: 'GET', url, options });
		return this.next();
	}
	post(url: string, body: unknown, options?: any): Observable<unknown> {
		this.requests.push({ method: 'POST', url, body, options });
		return this.next();
	}
}

function build() {
	const http = new HttpStub();
	const store = { selectedOrganization: { id: ORGANIZATION_ID } } as unknown as Store;
	const injector = Injector.create({
		providers: [
			{ provide: HttpClient, useValue: http },
			{ provide: Store, useValue: store }
		]
	});
	return { http, store, service: runInInjectionContext(injector, () => new DocsImportService()) };
}

const param = (request: { options?: { params?: HttpParams } }, name: string) => request.options?.params?.get(name);

describe('DocsImportService', () => {
	it('probes the import once per organization, and answers null on a 404', async () => {
		const { http, service, store } = build();
		http.responses.push({ items: [], maxZipBytes: 100 });
		expect(await firstValueFrom(service.probeImport())).toEqual({ items: [], maxZipBytes: 100 });
		expect(await firstValueFrom(service.probeImport())).toEqual({ items: [], maxZipBytes: 100 });
		expect(http.requests).toHaveLength(1);
		expect(http.requests[0].url).toMatch(/\/plugins\/docs\/imports$/);
		expect(param(http.requests[0], 'organizationId')).toBe(ORGANIZATION_ID);

		(store as any).selectedOrganization = { id: 'other-org' };
		http.responses.push(new HttpErrorResponse({ status: 404 }));
		expect(await firstValueFrom(service.probeImport())).toBeNull();
		expect(http.requests).toHaveLength(2);
	});

	it('probes the PDF export and hides it on a failure', async () => {
		const { http, service } = build();
		http.responses.push(new HttpErrorResponse({ status: 404 }));
		expect(await firstValueFrom(service.probePdf())).toBeNull();
		expect(http.requests[0].url).toMatch(/\/plugins\/docs\/exports\/pdf$/);
	});

	it('starts an import into a space: the file and only the DTO fields, with progress events', async () => {
		const { http, service } = build();
		http.responses.push({ type: 4 });
		const file = new File(['zip'], 'vault.zip', { type: 'application/zip' });
		await firstValueFrom(service.start(file, { visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: 'team-1' as ID }));
		const request = http.requests[0];
		expect(request.url).toMatch(/\/plugins\/docs\/imports$/);
		expect(request.options).toMatchObject({ reportProgress: true, observe: 'events' });
		const form = request.body as FormData;
		expect((form.get('file') as File).name).toBe('vault.zip');
		expect(form.get('visibility')).toBe(DocumentVisibilityEnum.TEAM);
		expect(form.get('organizationTeamId')).toBe('team-1');
		expect(form.get('organizationId')).toBe(ORGANIZATION_ID);
		expect(form.has('parentId')).toBe(false);
	});

	it('starts an import under a parent without a space (the parent decides it)', async () => {
		const { http, service } = build();
		http.responses.push({});
		await firstValueFrom(service.start(new File(['zip'], 'x.zip'), { parentId: PAGE_ID, visibility: DocumentVisibilityEnum.PRIVATE }));
		const form = http.requests[0].body as FormData;
		expect(form.get('parentId')).toBe(PAGE_ID);
		expect(form.has('visibility')).toBe(false);
	});

	it('reads an import in the selected organization', async () => {
		const { http, service } = build();
		http.responses.push({ id: 'import-1' });
		await firstValueFrom(service.get('import-1' as ID));
		expect(http.requests[0].url).toMatch(/\/plugins\/docs\/imports\/import-1$/);
		expect(param(http.requests[0], 'organizationId')).toBe(ORGANIZATION_ID);
	});

	it('downloads a subtree PDF under the name the server gives it', async () => {
		const { http, service } = build();
		const clicks: string[] = [];
		const createObjectURL = jest.fn(() => 'blob:x');
		Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
		jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
			clicks.push(this.download);
		});
		http.responses.push(
			new HttpResponse({ body: new Blob(['%PDF']), headers: new HttpHeaders({ 'Content-Disposition': `attachment; filename="handbook.pdf"; filename*=UTF-8''handbook.pdf` }) })
		);
		await expect(service.downloadPdf(PAGE_ID, { subtree: true })).resolves.toEqual({ ok: true });
		const request = http.requests[0];
		expect(request.url).toMatch(new RegExp(`/plugins/docs/documents/${PAGE_ID}/export\\.pdf$`));
		expect(param(request, 'subtree')).toBe('true');
		expect(param(request, 'format')).toBeNull();
		expect(request.options).toMatchObject({ observe: 'response', responseType: 'blob' });
		expect(clicks).toEqual(['handbook.pdf']);
	});

	it('answers the refusal of a PDF download', async () => {
		const { http, service } = build();
		http.responses.push(new HttpErrorResponse({ status: 413 }));
		const result = await service.downloadPdf(PAGE_ID);
		expect(result.ok).toBe(false);
		expect(result.error?.status).toBe(413);
	});
});
