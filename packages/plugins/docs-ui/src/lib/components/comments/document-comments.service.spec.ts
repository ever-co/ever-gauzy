/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core — importing it pulls
 * Akita's untranspiled ESM into the CommonJS test runtime. The service only ever
 * reads `Store.selectedOrganization`, so a stub keeps the suite honest without
 * booting the app graph (same treatment as `documents.service.spec.ts`).
 */
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));

import { HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, of } from 'rxjs';
import { BaseEntityEnum, ID } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { COMMENTS_PAGE_SIZE, DocumentCommentsService } from './document-comments.service';

const ORGANIZATION_ID = 'bbbbbbbb-1111-4111-8111-111111111111' as ID;
const TENANT_ID = 'bbbbbbbb-2222-4222-8222-222222222222' as ID;
const DOCUMENT_ID = 'bbbbbbbb-3333-4333-8333-333333333333' as ID;
const COMMENT_ID = 'bbbbbbbb-4444-4444-8444-444444444444' as ID;

interface RecordedRequest {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	url: string;
	body?: unknown;
	options?: { params?: HttpParams };
}

class HttpClientStub {
	public readonly requests: RecordedRequest[] = [];
	public response: unknown = null;

	get(url: string, options?: { params?: HttpParams }): Observable<unknown> {
		this.requests.push({ method: 'GET', url, options });
		return of(this.response);
	}

	post(url: string, body: unknown): Observable<unknown> {
		this.requests.push({ method: 'POST', url, body });
		return of(this.response);
	}

	put(url: string, body: unknown): Observable<unknown> {
		this.requests.push({ method: 'PUT', url, body });
		return of(this.response);
	}

	delete(url: string): Observable<unknown> {
		this.requests.push({ method: 'DELETE', url });
		return of(this.response);
	}

	get last(): RecordedRequest {
		return this.requests[this.requests.length - 1];
	}

	get params(): HttpParams {
		return this.last.options?.params ?? new HttpParams();
	}
}

describe('DocumentCommentsService', () => {
	let http: HttpClientStub;
	let service: DocumentCommentsService;

	beforeEach(() => {
		http = new HttpClientStub();
		const store = { selectedOrganization: { id: ORGANIZATION_ID, tenantId: TENANT_ID } } as unknown as Store;
		service = new DocumentCommentsService(http as never, store);
	});

	it('scopes the list to (Document, id) plus the tenant/organization the DTO requires', async () => {
		await firstValueFrom(service.getAll(DOCUMENT_ID));

		expect(http.last.method).toBe('GET');
		expect(http.last.url).toMatch(/\/comment$/);
		expect(http.params.get('where[entity]')).toBe(BaseEntityEnum.Document);
		expect(http.params.get('where[entityId]')).toBe(DOCUMENT_ID);
		// `BaseQueryDTO.where` is @IsNotEmpty() and the scope is read out of it.
		expect(http.params.get('where[organizationId]')).toBe(ORGANIZATION_ID);
		expect(http.params.get('where[tenantId]')).toBe(TENANT_ID);
	});

	it('asks for the author relations, oldest first, within the DTO page cap', async () => {
		await firstValueFrom(service.getAll(DOCUMENT_ID));

		// `toParams()` indexes arrays — `relations[0]`, `relations[1]`, …
		expect(http.params.get('relations[0]')).toBe('employee');
		expect(http.params.get('relations[1]')).toBe('employee.user');
		expect(http.params.get('order[createdAt]')).toBe('ASC');
		// `PaginationQueryDTO.take` is @Max(100) — a bigger page is a 400.
		expect(Number(http.params.get('take'))).toBeLessThanOrEqual(100);
		expect(Number(http.params.get('take'))).toBe(COMMENTS_PAGE_SIZE);
	});

	it('does NOT request `replies`: replies are rows of the same page and would double-count', async () => {
		await firstValueFrom(service.getAll(DOCUMENT_ID));

		const relations = http.params
			.keys()
			.filter((key) => key.startsWith('relations'))
			.map((key) => http.params.get(key));
		expect(relations).not.toContain('replies');
	});

	it('posts a comment with the organization scope and never with an author id', async () => {
		await firstValueFrom(
			service.create({
				entity: BaseEntityEnum.Document,
				entityId: DOCUMENT_ID,
				comment: 'hello',
				mentionEmployeeIds: ['e1' as ID]
			})
		);

		expect(http.last.method).toBe('POST');
		expect(http.last.body).toEqual({
			organizationId: ORGANIZATION_ID,
			tenantId: TENANT_ID,
			entity: BaseEntityEnum.Document,
			entityId: DOCUMENT_ID,
			comment: 'hello',
			mentionEmployeeIds: ['e1']
		});
		// The server takes the author from RequestContext; sending one would let a
		// client attribute a comment to someone else.
		expect(http.last.body).not.toHaveProperty('employeeId');
	});

	it('PUTs an update and DELETEs by id', async () => {
		await firstValueFrom(service.update(COMMENT_ID, { resolved: true }));
		expect(http.last.method).toBe('PUT');
		expect(http.last.url).toMatch(new RegExp(`/comment/${COMMENT_ID}$`));
		expect(http.last.body).toEqual({ resolved: true });

		await firstValueFrom(service.delete(COMMENT_ID));
		expect(http.last.method).toBe('DELETE');
		expect(http.last.url).toMatch(new RegExp(`/comment/${COMMENT_ID}$`));
	});

	it('still issues a scoped-by-entity query when no organization is selected', async () => {
		service = new DocumentCommentsService(http as never, { selectedOrganization: null } as unknown as Store);

		await firstValueFrom(service.getAll(DOCUMENT_ID));

		expect(http.params.get('where[entityId]')).toBe(DOCUMENT_ID);
		expect(http.params.get('where[organizationId]')).toBeNull();
	});
});
