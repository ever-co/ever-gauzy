import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	Post,
	Put,
	Query,
	Req,
	UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { EverOperatorService } from '@gauzy/plugin-ever-instance';
import { AuditRow, EverConnectAuditService } from './ever-connect-audit.service';
import type { EverConnectConfig } from './ever-connect-config';
import { ConnectionSummary, EverConnectConnectionService } from './ever-connect-connection.service';
import { EVER_CONNECT_SETTINGS } from './ever-connect.constants';
import { EntitlementSummary, EverConnectEntitlementService } from './ever-connect-entitlement.service';
import { EverConnectIntegrationStateService, IntegrationView } from './ever-connect-integration-state.service';
import { EverConnectLinkService, LinkView } from './ever-connect-link.service';
import { organizationScope } from './ever-connect-request';
import type { RequestWithUser } from './ever-connect-request';
import { EverConnectStore } from './ever-connect.store';
import { EverConnectEnabledGuard } from './guards/ever-connect-operator.guard';

/** `GET /api/ever-connect/status`. */
export interface EverConnectStatus {
	/** The module is loaded (the web app hides the Ever Platform card when this route answers 404). */
	enabled: true;
	install_source: string;
	/** `ever_cloud` when Ever operates this installation (`EVER_INSTALL_SOURCE=cloud`). */
	managed_by: 'ever_cloud' | 'operator';
	/** Whether the caller is the operator of this installation (sees the Connection tab). */
	operator: boolean;
	connected: boolean;
	/** The connection details: for the operator only. */
	connection: ConnectionSummary | null;
	/** This organization's link. */
	link: LinkView | null;
	/** Installation-wide integrations waiting for the operator's accept: for the operator only. */
	pending_approvals: IntegrationView[];
	/** The in-product consent dialog (a later release): always off here. */
	in_product_consent: false;
}

/**
 * The organization side of the Ever Platform connection, behind Gauzy's tenant and permission
 * guards with the existing integration permissions (no new permission): the status, the link of the
 * organization, its integrations and consents, its entitlement document and its audit. The
 * installation-wide integrations answer 404 to everyone but the operator. No answer is cached.
 */
@ApiTags('Ever Platform')
@ApiBearerAuth()
@UseGuards(EverConnectEnabledGuard, TenantPermissionGuard, PermissionGuard)
@Controller('/ever-connect')
export class EverConnectController {
	constructor(
		private readonly connection: EverConnectConnectionService,
		private readonly links: EverConnectLinkService,
		private readonly states: EverConnectIntegrationStateService,
		private readonly entitlements: EverConnectEntitlementService,
		private readonly audit: EverConnectAuditService,
		private readonly store: EverConnectStore,
		private readonly operator: EverOperatorService,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig
	) {}

	@Get('status')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	async status(
		@Req() request: RequestWithUser,
		@Query('organizationId') organizationId?: string
	): Promise<EverConnectStatus> {
		const scope = organizationId
			? await organizationScope(request, organizationId, this.store, this.operator)
			: null;
		const isOperator = scope?.isOperator ?? (await this.isOperator(request));
		const summary = await this.connection.summary();
		return {
			enabled: true,
			install_source: this.config.installSource,
			managed_by: this.config.cloud ? 'ever_cloud' : 'operator',
			operator: isOperator,
			connected: summary.status === 'connected',
			connection: isOperator ? summary : null,
			link: scope ? await this.links.current(scope.tenantId, scope.organizationId) : null,
			pending_approvals: isOperator ? await this.states.pendingApprovals() : [],
			in_product_consent: false
		};
	}

	@Get('integrations')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	async integrations(
		@Req() request: RequestWithUser,
		@Query('organizationId') organizationId?: string
	): Promise<IntegrationView[]> {
		const scope = await organizationScope(request, organizationId, this.store, this.operator);
		return this.states.list(scope);
	}

	/** Re-reads the states from Ever Platform (on return from app.ever.co). */
	@Post('integrations/refresh')
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@Header('Cache-Control', 'no-store')
	async refresh(
		@Req() request: RequestWithUser,
		@Query('organizationId') organizationId?: string
	): Promise<IntegrationView[]> {
		const scope = await organizationScope(request, organizationId, this.store, this.operator);
		await this.states.sync('user');
		return this.states.list(scope);
	}

	/**
	 * The app.ever.co consent link. For the installation-wide integrations (`instance_url`,
	 * `stats_link`, `ever_id_login`, `webhooks`) only the operator gets one; everyone else 404.
	 */
	@Post('integrations/:key/consent-url')
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@Header('Cache-Control', 'no-store')
	async consentUrl(
		@Req() request: RequestWithUser,
		@Param('key') key: string,
		@Query('organizationId') organizationId?: string
	) {
		const scope = await organizationScope(request, organizationId, this.store, this.operator);
		return this.states.consentUrl(key, scope);
	}

	/** `{ "enabled": false }` switches an integration off; `{ "enabled": true }` answers 409 `consent_required`. */
	@Put('integrations/:key')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@Header('Cache-Control', 'no-store')
	async setEnabled(
		@Req() request: RequestWithUser,
		@Param('key') key: string,
		@Body() body: { enabled?: unknown },
		@Query('organizationId') organizationId?: string
	): Promise<IntegrationView> {
		if (typeof body?.enabled !== 'boolean') {
			throw new BadRequestException('enabled must be true or false');
		}
		const scope = await organizationScope(request, organizationId, this.store, this.operator);
		return this.states.setEnabled(key, body.enabled, scope);
	}

	/** Links this organization with a link code from app.ever.co: `{ "link_code": "EVL-…" }`. */
	@Post('links')
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	@Header('Cache-Control', 'no-store')
	async link(
		@Req() request: RequestWithUser,
		@Body() body: { link_code?: unknown },
		@Query('organizationId') organizationId?: string
	): Promise<LinkView> {
		const scope = await organizationScope(request, organizationId, this.store, this.operator);
		return this.links.link({
			linkCode: typeof body?.link_code === 'string' ? body.link_code : '',
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			userId: scope.userId
		});
	}

	/** Removes this organization's link (its Gauzy integration record id). */
	@Delete('links/:integrationTenantId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	@Header('Cache-Control', 'no-store')
	async unlink(
		@Req() request: RequestWithUser,
		@Param('integrationTenantId') integrationTenantId: string,
		@Query('organizationId') organizationId?: string
	): Promise<void> {
		const scope = await organizationScope(request, organizationId, this.store, this.operator);
		await this.links.unlink({
			integrationTenantId,
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			userId: scope.userId
		});
	}

	/** The decoded entitlement documents (the installation's, this organization's link's). */
	@Get('entitlement')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	async entitlement(
		@Req() request: RequestWithUser,
		@Query('organizationId') organizationId?: string
	): Promise<{ instance: EntitlementSummary | null; link: EntitlementSummary | null }> {
		const scope = await organizationScope(request, organizationId, this.store, this.operator);
		return this.entitlements.summary(scope.tenantId, scope.organizationId);
	}

	/** Refreshes the documents now (at most 6 an hour). */
	@Post('entitlement/refresh')
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@Header('Cache-Control', 'no-store')
	async refreshEntitlement(@Req() request: RequestWithUser, @Query('organizationId') organizationId?: string) {
		const scope = await organizationScope(request, organizationId, this.store, this.operator);
		await this.entitlements.refreshOnDemand(scope);
		return this.entitlements.summary(scope.tenantId, scope.organizationId);
	}

	/** This organization's audit, newest first (the installation's own rows for the operator only). */
	@Get('audit')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	async auditPage(
		@Req() request: RequestWithUser,
		@Query('organizationId') organizationId?: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string,
		@Query('integration') integration?: string
	): Promise<{ items: AuditRow[]; total: number }> {
		const scope = await organizationScope(request, organizationId, this.store, this.operator);
		return this.audit.list({
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			includeInstance: scope.isOperator,
			integration: integration || null,
			page: Number(page) || 1,
			limit: Number(limit) || 20
		});
	}

	private async isOperator(request: RequestWithUser): Promise<boolean> {
		const user = request?.user;
		const role = user?.role;
		return this.operator.isOperator(user, typeof role === 'string' ? role : (role?.name ?? null));
	}
}
