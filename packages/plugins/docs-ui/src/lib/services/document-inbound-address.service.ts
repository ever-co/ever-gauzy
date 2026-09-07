import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
	DocumentInboundAddressKindEnum,
	ID,
	IDocumentInboundAddress,
	IDocumentInboundAddressCreateInput,
	IDocumentInboundAddressSecret,
	IDocumentInboundAddressUpdateInput,
	IDocumentInboundDomainVerification
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { IDocumentInboundAddressCreateResult, IDocumentInboundAddressView } from '../models/docs-inbound.model';

/**
 * HTTP client for the inbound email capture settings (`@gauzy/plugin-docs`,
 * `DocumentInboundAddressController`). One method per endpoint, scoped to its consumer the
 * same way `document-activity.service.ts` is.
 *
 * 🛑 **The scope is a plain `organizationId` — never a `where[…]`, never a `tenantId`.**
 * Every route on this controller binds a flat DTO (`DocumentInboundAddressQueryDTO`,
 * `Create…DTO`, `Update…DTO`) whose only scope member is `organizationId?: ID`, under
 * `ValidationPipe({ whitelist: true })`. A nested `where` is therefore stripped in silence and
 * the server falls back to `RequestContext.currentOrganizationId()`, and `tenantId` is not a
 * declared field at all — the controller reads it from `RequestContext.currentTenantId()`.
 * Sending either would be a dead field that merely looks like scoping. (The list/count/facets
 * trio in `documents.service.ts` nests under `where` because it binds `BaseQueryDTO`; the two
 * shapes are not interchangeable.)
 *
 * 🛑 Every response funnels through {@link toView}, which drops `webhookSecretHash`. The
 * controller already omits it, but this is the single seam every component reads through, so a
 * leak upstream cannot reach a template.
 */
@Injectable()
export class DocumentInboundAddressService {
	private readonly API_URL = `${API_PREFIX}/plugins/docs/inbound-addresses`;

	constructor(private readonly http: HttpClient, private readonly store: Store) {}

	/**
	 * The organization's capture addresses.
	 *
	 * The platform address is minted server-side on the first call, so an organization that has
	 * never opened this page still gets one back. An empty list means the deployment has no
	 * inbound domain configured — there was nothing to mint.
	 */
	getAll(): Observable<IDocumentInboundAddressView[]> {
		return this.http
			.get<IDocumentInboundAddress[]>(this.API_URL, { params: toParams(this.scope()) })
			.pipe(map((rows) => (rows ?? []).map((row) => this.toView(row))));
	}

	/**
	 * Registers a capture address on a domain the organization owns.
	 *
	 * 🛑 The response carries the plaintext relay secret, and this is the ONLY time it is ever
	 * returned — the caller must surface it before doing anything else with the result.
	 *
	 * `kind` is forced to `CUSTOM_DOMAIN`: the controller rejects anything else (the platform
	 * address is minted automatically, and a second creation path would let a caller mint
	 * duplicates for one organization).
	 */
	create(input: Omit<IDocumentInboundAddressCreateInput, 'kind'>): Observable<IDocumentInboundAddressCreateResult> {
		return this.http
			.post<IDocumentInboundAddressCreateResult>(this.API_URL, {
				...input,
				kind: DocumentInboundAddressKindEnum.CUSTOM_DOMAIN,
				...this.scope()
			})
			.pipe(map((result) => ({ ...result, address: this.toView(result?.address as IDocumentInboundAddress) })));
	}

	/**
	 * The DNS TXT record to publish and where verification currently stands.
	 *
	 * Read from the server rather than rebuilt client-side: the record NAME is derived from a
	 * backend constant (`_gauzy-docs.<domain>`), and a UI that guessed it would keep telling
	 * people to publish the wrong record the day that prefix changes.
	 */
	getVerification(id: ID): Observable<IDocumentInboundDomainVerification> {
		return this.http.get<IDocumentInboundDomainVerification>(`${this.API_URL}/${id}/verification`, {
			params: toParams(this.scope())
		});
	}

	/**
	 * Performs the DNS lookup and arms the address if the record is present.
	 *
	 * A missing record is **not** an error response: the endpoint answers 200 with the unchanged
	 * (or degraded) status plus a `message` saying why. Callers must read `status`, not assume
	 * success from the absence of a throw.
	 */
	verify(id: ID): Observable<IDocumentInboundDomainVerification> {
		return this.http.post<IDocumentInboundDomainVerification>(`${this.API_URL}/${id}/verify`, this.scope());
	}

	/**
	 * Issues a new relay secret and invalidates the previous one immediately.
	 *
	 * 🛑 Plaintext, returned once. Same handling rule as {@link create}.
	 */
	rotateSecret(id: ID): Observable<IDocumentInboundAddressSecret> {
		return this.http.post<IDocumentInboundAddressSecret>(`${this.API_URL}/${id}/rotate-secret`, this.scope());
	}

	/**
	 * Mints a new token for a PLATFORM address — i.e. a new address. The old one stops resolving
	 * at once, so anything still mailing it will bounce. `CUSTOM_DOMAIN` rows are rejected by the
	 * server (their address is the tenant's own choice, not a minted token).
	 */
	rotateAddress(id: ID): Observable<IDocumentInboundAddressView> {
		return this.http
			.post<IDocumentInboundAddress>(`${this.API_URL}/${id}/rotate-address`, this.scope())
			.pipe(map((row) => this.toView(row)));
	}

	/**
	 * Updates the sender allowlist, the body-import preference or the active flag.
	 *
	 * An empty `senderAllowlist` array is meaningful and must be sent as such: it clears the list,
	 * which the server reads as "accept any sender that passes SPF/DKIM".
	 */
	update(id: ID, input: IDocumentInboundAddressUpdateInput): Observable<IDocumentInboundAddressView> {
		return this.http
			.put<IDocumentInboundAddress>(`${this.API_URL}/${id}`, { ...input, ...this.scope() })
			.pipe(map((row) => this.toView(row)));
	}

	/**
	 * The organization scope every route on this controller accepts.
	 *
	 * Returns `{}` rather than `{ organizationId: undefined }` when nothing is selected —
	 * `toParams()` serializes `undefined` as the literal string `"undefined"`, which would be a
	 * 400 on `@IsUUID()` instead of the intended "fall back to the request context".
	 */
	private scope(): { organizationId?: ID } {
		const organizationId = this.store.selectedOrganization?.id as ID;
		return organizationId ? { organizationId } : {};
	}

	/**
	 * Response projection: drops `webhookSecretHash` before anything else can see it.
	 *
	 * A hash is still a verifier. The controller strips it already, so in practice this removes
	 * nothing — which is exactly why it belongs here rather than in a component: it costs one
	 * destructure and it holds even if the server ever regresses.
	 */
	private toView(row: IDocumentInboundAddress): IDocumentInboundAddressView {
		const { webhookSecretHash: _ignored, ...view } = (row ?? {}) as IDocumentInboundAddress;
		return view as IDocumentInboundAddressView;
	}
}
