import {
	ConflictException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
	UnprocessableEntityException
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EverConnectAuditService } from './ever-connect-audit.service';
import { LINK_CODE_SHAPE, PRODUCT } from './ever-connect.constants';
import { checkLinkBinding, EverConnectEntitlementService, LinkBindingError } from './ever-connect-entitlement.service';
import { EverConnectIntegrationStateService } from './ever-connect-integration-state.service';
import {
	EverConnectPlatformService,
	errorCode,
	isCredentialRevoked,
	isUnreachable
} from './ever-connect-platform.service';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore, LinkRecord, LiveLinkExistsError } from './ever-connect.store';
import { EntitlementError, ProblemError, VerifiedEntitlement } from './sdk';

/** What the Organization link tab shows. */
export interface LinkView {
	integration_tenant_id: string | null;
	link_id: string;
	ever_org_id: string;
	handle: string | null;
	status: string;
	linked_at: string;
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export const linkView = (link: LinkRecord): LinkView => ({
	integration_tenant_id: link.integrationTenantId,
	link_id: link.linkId,
	ever_org_id: link.everOrgId,
	handle: link.everHandle,
	status: link.status,
	linked_at: new Date(link.createdAt).toISOString()
});

/**
 * Tenant links: one Gauzy organization ↔ one Ever organization. An administrator pastes a link code
 * minted in app.ever.co (`POST /v1/instances/me/tenant-links`); the link's entitlement document is
 * verified before anything is stored. Gauzy's own record of the link is an `integration_tenant` row
 * named `Ever_Connect`; removing the link archives it.
 */
@Injectable()
export class EverConnectLinkService {
	private readonly logger = new Logger('EverConnect');

	constructor(
		private readonly platform: EverConnectPlatformService,
		private readonly store: EverConnectStore,
		private readonly audit: EverConnectAuditService,
		private readonly entitlements: EverConnectEntitlementService,
		private readonly states: EverConnectIntegrationStateService,
		private readonly signals: EverConnectSignals
	) {}

	async current(tenantId: string, organizationId: string): Promise<LinkView | null> {
		const link = await this.store.linkOf(tenantId, organizationId);
		return link ? linkView(link) : null;
	}

	/** Links this organization with a link code (`EVL-…`). */
	async link(input: {
		linkCode: string;
		tenantId: string;
		organizationId: string;
		userId: string | null;
	}): Promise<LinkView> {
		const code = String(input.linkCode ?? '').trim();
		if (!LINK_CODE_SHAPE.test(code)) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				code: 'code_invalid',
				message: 'This is not a link code (EVL-XXXX-XXXX-XXXX).'
			});
		}
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !connection.platformInstanceId) {
			throw new ConflictException({
				statusCode: 409,
				code: 'not_connected',
				message: 'This installation is not connected to Ever Platform.'
			});
		}
		if (await this.store.linkOf(input.tenantId, input.organizationId)) {
			throw new ConflictException({
				statusCode: 409,
				code: 'already_linked',
				message: 'This organization is already linked.'
			});
		}
		const client = await this.platform.getClient();
		let created: { id: string; org_id: string };
		try {
			created = (await client.instances.tenantLinks.create(
				{
					link_code: code.toUpperCase(),
					product: PRODUCT,
					product_tenant_id: input.tenantId,
					product_org_id: input.organizationId
				},
				sha256(
					`link|${connection.platformInstanceId}|${input.tenantId}|${input.organizationId}|${code.toUpperCase()}`
				)
			)) as { id: string; org_id: string };
		} catch (error) {
			throw this.problem(error);
		}
		const linkId = created.id;
		let verified: VerifiedEntitlement;
		try {
			verified = await this.entitlements.fetchLinkDocument(linkId);
			checkLinkBinding(verified, input);
		} catch (error) {
			// Nothing is stored for a link whose document does not verify (or names another tenant or
			// organization); the platform is told the link is not used (best effort).
			await client.instances.tenantLinks.remove(linkId).catch(() => undefined);
			if (error instanceof EntitlementError || error instanceof LinkBindingError) {
				throw new UnprocessableEntityException({
					statusCode: 422,
					code: 'entitlement_unverifiable',
					message: "Ever Platform's entitlement document for this link could not be verified."
				});
			}
			throw this.problem(error);
		}
		try {
			return await this.store_(input, created.org_id, linkId, verified, input.userId);
		} catch (error) {
			if (error instanceof LiveLinkExistsError) {
				// Another request linked this organization meanwhile: this link is not used.
				await client.instances.tenantLinks.remove(linkId).catch(() => undefined);
				throw new ConflictException({
					statusCode: 409,
					code: 'already_linked',
					message: 'This organization is already linked.'
				});
			}
			throw error;
		}
	}

	/** Stores a link the redeem created (a connect code that pre-binds the organization). */
	async storeFromRedeem(
		input: { tenantId: string; organizationId: string; userId: string | null },
		everOrgId: string,
		linkId: string
	): Promise<LinkView | null> {
		const verified = await this.entitlements.fetchLinkDocument(linkId);
		checkLinkBinding(verified, input);
		return this.store_(input, everOrgId, linkId, verified, input.userId);
	}

	private async store_(
		owner: { tenantId: string; organizationId: string },
		everOrgId: string,
		linkId: string,
		verified: VerifiedEntitlement,
		userId: string | null
	): Promise<LinkView> {
		const handle = verified.claims.ever.handle ?? null;
		// The link row first: its unique live key refuses a second live link for this organization
		// (two requests at once). Then Gauzy's own record of it; when that cannot be written, the link
		// row goes too.
		const link = await this.store.insertLink({
			tenantId: owner.tenantId,
			organizationId: owner.organizationId,
			integrationTenantId: null,
			linkId,
			everOrgId,
			everHandle: handle,
			status: 'linked',
			entitlementJwsEncrypted: null,
			entitlementSeq: null,
			entitlementIat: null,
			entitlementExp: null,
			entitlementFetchedAt: null,
			linkedByUserId: userId
		});
		let integrationTenantId: string;
		try {
			integrationTenantId = await this.store.createLinkRecord(owner, {
				EVER_LINK_ID: linkId,
				EVER_ORG_ID: everOrgId,
				EVER_HANDLE: handle ?? '',
				EVER_LINK_STATUS: 'linked',
				ENTITLEMENT_SEQ: String(verified.seq),
				ENTITLEMENT_EXP: String(verified.claims.exp)
			});
		} catch (error) {
			await this.store.deleteLink(linkId);
			throw error;
		}
		await this.store.updateLink(linkId, {
			integrationTenantId,
			...this.entitlements.linkDocumentColumns(verified)
		});
		await this.audit.record({
			action: 'link.create',
			actorLabel: 'user',
			actorUserId: userId,
			tenantId: owner.tenantId,
			organizationId: owner.organizationId,
			details: { link_id: linkId, ever_org_id: everOrgId }
		});
		await this.states
			.sync({ force: true })
			.catch((error) => this.logger.warn(`Integration states could not be read now (${errorCode(error)}).`));
		return linkView((await this.store.linkById(linkId)) ?? link);
	}

	/**
	 * Removes the link of an organization (`integrationTenantId` is its Gauzy record): Ever Platform is
	 * told when it can be reached; here the link is archived and its integrations switched off anyway.
	 */
	async unlink(input: {
		integrationTenantId: string;
		tenantId: string;
		organizationId: string;
		userId: string | null;
	}): Promise<void> {
		const link = await this.store.linkByIntegrationTenant(input.integrationTenantId);
		if (
			!link ||
			link.tenantId !== input.tenantId ||
			link.organizationId !== input.organizationId ||
			link.status === 'unlinked'
		) {
			throw new NotFoundException();
		}
		let remote = false;
		const connection = await this.store.connection();
		if (connection.status === 'connected') {
			try {
				await (await this.platform.getClient()).instances.tenantLinks.remove(link.linkId);
				remote = true;
			} catch (error) {
				if (isCredentialRevoked(error)) this.signals.revoked$.next();
				else if (error instanceof ProblemError && error.status === 404) remote = true;
				else this.logger.warn(`Ever Platform was not told about the removed link (${errorCode(error)}).`);
			}
		}
		await this.unlinkLocally(link, 'user', input.userId, remote);
	}

	/** The local half of removing a link (also when Ever Platform removed it). */
	async unlinkLocally(
		link: LinkRecord,
		actorLabel: 'user' | 'platform' | 'operator' | 'system',
		userId: string | null,
		remote: boolean
	): Promise<void> {
		if (link.status === 'unlinked') {
			return;
		}
		await this.store.updateLink(link.linkId, {
			status: 'unlinked',
			unlinkedAt: Date.now(),
			entitlementJwsEncrypted: null
		});
		if (link.integrationTenantId) {
			await this.store.updateLinkRecordSettings(link.integrationTenantId, { EVER_LINK_STATUS: 'unlinked' });
			await this.store.archiveLinkRecord(link.integrationTenantId);
		}
		await this.states.linkOffLocally(link.linkId);
		await this.audit.record({
			action: 'link.remove',
			actorLabel,
			actorUserId: userId,
			tenantId: link.tenantId,
			organizationId: link.organizationId,
			details: { link_id: link.linkId, remote }
		});
	}

	/** A link's state changed on Ever Platform (suspended, orphaned, resumed). */
	async linkStateChanged(linkId: string, status: 'suspended' | 'orphaned' | 'linked'): Promise<void> {
		const link = await this.store.linkById(linkId);
		if (!link || link.status === 'unlinked' || link.status === status) return;
		await this.store.updateLink(linkId, { status });
		if (link.integrationTenantId) {
			await this.store.updateLinkRecordSettings(link.integrationTenantId, { EVER_LINK_STATUS: status });
		}
	}

	private problem(error: unknown): Error {
		if (isCredentialRevoked(error)) {
			this.signals.revoked$.next();
		}
		if (error instanceof ProblemError) {
			if (isUnreachable(error)) {
				return new HttpException(
					{ statusCode: 502, code: 'platform_unreachable', message: 'Ever Platform could not be reached.' },
					HttpStatus.BAD_GATEWAY
				);
			}
			const status = error.status === 409 ? 409 : error.status === 404 ? 404 : 422;
			return new HttpException(
				{ statusCode: status, code: error.code, message: 'Ever Platform refused the link code.' },
				status
			);
		}
		if (isUnreachable(error)) {
			return new HttpException(
				{ statusCode: 502, code: 'platform_unreachable', message: 'Ever Platform could not be reached.' },
				HttpStatus.BAD_GATEWAY
			);
		}
		return error as Error;
	}
}
