/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core — importing it pulls Akita's
 * untranspiled ESM into the CommonJS test runtime. The service only ever reads
 * `Store.selectedOrganization`, so a stub keeps the suite honest without booting the app graph
 * (same treatment as `document-activity.service.spec.ts`).
 */
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));

import { HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, of } from 'rxjs';
import {
	DocumentInboundAddressKindEnum,
	DocumentInboundDomainStatusEnum,
	ID,
	IDocumentInboundAddress
} from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { DocumentInboundAddressService } from './document-inbound-address.service';

const ORGANIZATION_ID = 'eeeeeeee-1111-4111-8111-111111111111' as ID;
const TENANT_ID = 'eeeeeeee-2222-4222-8222-222222222222' as ID;
const ADDRESS_ID = 'eeeeeeee-3333-4333-8333-333333333333' as ID;

class HttpClientStub {
	public readonly requests: { method: string; url: string; body?: unknown; params?: HttpParams }[] = [];
	public response: unknown = [];

	get(url: string, options?: { params?: HttpParams }): Observable<unknown> {
		this.requests.push({ method: 'GET', url, params: options?.params });
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

	get last(): { method: string; url: string; body?: unknown; params?: HttpParams } {
		return this.requests[this.requests.length - 1];
	}
}

/** A wire row shaped like `DocumentInboundAddressController.toResponse()`. */
function wireRow(overrides: Partial<IDocumentInboundAddress> = {}): IDocumentInboundAddress {
	return {
		id: ADDRESS_ID,
		kind: DocumentInboundAddressKindEnum.PLATFORM,
		address: 'docs-abc123@inbound.gauzy.co',
		domainStatus: DocumentInboundDomainStatusEnum.VERIFIED,
		senderAllowlist: [],
		importBodyAsNote: false,
		isActive: true,
		...overrides
	} as IDocumentInboundAddress;
}

function createService(organization: unknown = { id: ORGANIZATION_ID, tenantId: TENANT_ID }) {
	const http = new HttpClientStub();
	const service = new DocumentInboundAddressService(http as never, {
		selectedOrganization: organization
	} as unknown as Store);
	return { http, service };
}

/**
 * The two regressions this file exists for:
 *
 * 1. **Scope shape.** Every route on `DocumentInboundAddressController` binds a FLAT DTO whose
 *    only scope member is `organizationId`. Nesting it under `where[…]` (the shape the
 *    list/count/facets trio uses, because those bind `BaseQueryDTO`) is silently stripped by
 *    `whitelist: true`, and the server then falls back to the request context — which looks like
 *    it worked right up until someone has two organizations.
 * 2. **`webhookSecretHash` must never reach a component.** A hash is still a verifier.
 */
describe('DocumentInboundAddressService (spec 07 §17.2)', () => {
	it('sends a PLAIN organizationId on the list read — never a where[…]', async () => {
		const { http, service } = createService();

		await firstValueFrom(service.getAll());

		expect(http.last.url).toMatch(/\/plugins\/docs\/inbound-addresses$/);
		expect(http.last.params?.get('organizationId')).toBe(ORGANIZATION_ID);
		expect(http.last.params?.get('where[organizationId]')).toBeNull();
	});

	it('never sends a tenantId — the controller takes it from the request context', async () => {
		const { http, service } = createService();

		await firstValueFrom(service.getAll());

		// `DocumentInboundAddressQueryDTO` declares no `tenantId`; sending one would be a dead
		// field that merely looks like scoping.
		expect(http.last.params?.get('tenantId')).toBeNull();
	});

	it('omits the scope entirely when no organization is selected — never sends "undefined"', async () => {
		const { http, service } = createService(null);

		await firstValueFrom(service.getAll());

		// `toParams()` serializes `undefined` as the literal string "undefined", which would fail
		// `@IsUUID()` with a 400 instead of falling back to the request context.
		expect(http.last.params?.get('organizationId')).toBeNull();
	});

	it('🛑 strips webhookSecretHash off every row it hands back', async () => {
		const { http, service } = createService();
		http.response = [wireRow({ webhookSecretHash: 'a'.repeat(64) })];

		const rows = await firstValueFrom(service.getAll());

		expect(rows).toHaveLength(1);
		expect(Object.prototype.hasOwnProperty.call(rows[0], 'webhookSecretHash')).toBe(false);
		expect(JSON.stringify(rows)).not.toContain('a'.repeat(64));
	});

	it('strips the hash off a rotated address and an update response too', async () => {
		const { http, service } = createService();
		http.response = wireRow({ webhookSecretHash: 'b'.repeat(64) });

		const rotated = await firstValueFrom(service.rotateAddress(ADDRESS_ID));
		const updated = await firstValueFrom(service.update(ADDRESS_ID, { isActive: false }));

		expect(Object.prototype.hasOwnProperty.call(rotated, 'webhookSecretHash')).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(updated, 'webhookSecretHash')).toBe(false);
	});

	it('forces kind=CUSTOM_DOMAIN on create — the platform address is minted server-side', async () => {
		const { http, service } = createService();
		http.response = { address: wireRow(), secret: { address: 'x', webhookSecret: 'y' }, verification: {} };

		await firstValueFrom(service.create({ domain: 'example.com', localPart: 'docs', importBodyAsNote: true }));

		expect(http.last.method).toBe('POST');
		expect(http.last.body).toEqual({
			domain: 'example.com',
			localPart: 'docs',
			importBodyAsNote: true,
			kind: DocumentInboundAddressKindEnum.CUSTOM_DOMAIN,
			organizationId: ORGANIZATION_ID
		});
	});

	it('sends an EMPTY allowlist as an empty array — that is how the list is cleared', async () => {
		const { http, service } = createService();
		http.response = wireRow();

		await firstValueFrom(service.update(ADDRESS_ID, { senderAllowlist: [] }));

		expect(http.last.method).toBe('PUT');
		expect(http.last.url).toMatch(new RegExp(`/inbound-addresses/${ADDRESS_ID}$`));
		// Omitting it would leave the old list in place; the server reads `[]` as
		// "accept any sender that passes SPF/DKIM".
		expect(http.last.body).toEqual({ senderAllowlist: [], organizationId: ORGANIZATION_ID });
	});

	it('puts the scope in the BODY of every POST, where the DTO expects it', async () => {
		const { http, service } = createService();
		http.response = {};

		await firstValueFrom(service.verify(ADDRESS_ID));
		expect(http.last.url).toMatch(/\/verify$/);
		expect(http.last.body).toEqual({ organizationId: ORGANIZATION_ID });

		await firstValueFrom(service.rotateSecret(ADDRESS_ID));
		expect(http.last.url).toMatch(/\/rotate-secret$/);
		expect(http.last.body).toEqual({ organizationId: ORGANIZATION_ID });
	});

	it('reads the DNS record from the server rather than rebuilding it client-side', async () => {
		const { http, service } = createService();
		http.response = {};

		await firstValueFrom(service.getVerification(ADDRESS_ID));

		// The record NAME is derived from a backend constant (`_gauzy-docs.<domain>`); a UI that
		// guessed it would keep telling people to publish the wrong record if that prefix moved.
		expect(http.last.method).toBe('GET');
		expect(http.last.url).toMatch(new RegExp(`/inbound-addresses/${ADDRESS_ID}/verification$`));
		expect(http.last.params?.get('organizationId')).toBe(ORGANIZATION_ID);
	});
});
