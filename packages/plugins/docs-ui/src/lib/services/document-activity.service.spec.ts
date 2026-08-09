/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core — importing it pulls Akita's
 * untranspiled ESM into the CommonJS test runtime. The service only ever reads
 * `Store.selectedOrganization`, so a stub keeps the suite honest without booting the app graph
 * (same treatment as `document-comments.service.spec.ts`).
 */
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));

import { HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, of } from 'rxjs';
import { BaseEntityEnum, ID } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import {
	DOCS_ACTIVITY_PAGE_SIZE,
	DocumentActivityService
} from './document-activity.service';

const ORGANIZATION_ID = 'dddddddd-1111-4111-8111-111111111111' as ID;
const TENANT_ID = 'dddddddd-2222-4222-8222-222222222222' as ID;
const DOCUMENT_ID = 'dddddddd-3333-4333-8333-333333333333' as ID;

class HttpClientStub {
	public readonly requests: { url: string; options?: { params?: HttpParams } }[] = [];
	public response: unknown = { items: [], total: 0 };

	get(url: string, options?: { params?: HttpParams }): Observable<unknown> {
		this.requests.push({ url, options });
		return of(this.response);
	}

	get params(): HttpParams {
		return this.requests[this.requests.length - 1]?.options?.params ?? new HttpParams();
	}
}

describe('DocumentActivityService', () => {
	let http: HttpClientStub;
	let service: DocumentActivityService;

	beforeEach(() => {
		http = new HttpClientStub();
		const store = { selectedOrganization: { id: ORGANIZATION_ID, tenantId: TENANT_ID } } as unknown as Store;
		service = new DocumentActivityService(http as never, store);
	});

	it('scopes the read to (Document, id) on the core activity-log endpoint', async () => {
		await firstValueFrom(service.getPage(DOCUMENT_ID));

		expect(http.requests[0].url).toMatch(/\/activity-log$/);
		expect(http.params.get('entity')).toBe(BaseEntityEnum.Document);
		expect(http.params.get('entityId')).toBe(DOCUMENT_ID);
	});

	it('sends the organization scope the DTO requires', async () => {
		await firstValueFrom(service.getPage(DOCUMENT_ID));

		// `GetActivityLogsDTO` intersects `TenantOrganizationBaseDTO`, whose `organization`
		// member is validated as soon as `organizationId` is absent — an unscoped call is a 400.
		expect(http.params.get('organizationId')).toBe(ORGANIZATION_ID);
		expect(http.params.get('tenantId')).toBe(TENANT_ID);
	});

	it('asks for the newest rows first with the author relations joined', async () => {
		await firstValueFrom(service.getPage(DOCUMENT_ID));

		expect(http.params.get('orderBy')).toBe('createdAt');
		expect(http.params.get('order')).toBe('DESC');
		// `toParams()` indexes arrays — `relations[0]`, `relations[1]`, …
		expect(http.params.get('relations[0]')).toBe('employee');
		expect(http.params.get('relations[1]')).toBe('employee.user');
	});

	it('stays inside the DTO page cap', async () => {
		await firstValueFrom(service.getPage(DOCUMENT_ID));

		expect(Number(http.params.get('take'))).toBe(DOCS_ACTIVITY_PAGE_SIZE);
		// `PaginationQueryDTO.take` is @Max(100) — a bigger page is a 400.
		expect(Number(http.params.get('take'))).toBeLessThanOrEqual(100);
	});

	it('🛑 pages by PAGE NUMBER, not by offset', async () => {
		await firstValueFrom(service.getPage(DOCUMENT_ID, 1));
		expect(http.params.get('skip')).toBe('1');

		await firstValueFrom(service.getPage(DOCUMENT_ID, 3));
		// `findActivityLogs()` computes `skip: take * (skip - 1)`, so sending an offset
		// (`skip += take`) would jump 20 pages per click and answer an empty timeline.
		expect(http.params.get('skip')).toBe('3');
	});

	it('clamps a nonsensical page onto the first one', async () => {
		await firstValueFrom(service.getPage(DOCUMENT_ID, 0));

		expect(http.params.get('skip')).toBe('1');
	});

	it('omits the scope entirely when no organization is selected — never sends "undefined"', async () => {
		service = new DocumentActivityService(http as never, { selectedOrganization: null } as unknown as Store);

		await firstValueFrom(service.getPage(DOCUMENT_ID));

		expect(http.params.get('entityId')).toBe(DOCUMENT_ID);
		expect(http.params.get('organizationId')).toBeNull();
		expect(http.params.get('tenantId')).toBeNull();
	});
});
