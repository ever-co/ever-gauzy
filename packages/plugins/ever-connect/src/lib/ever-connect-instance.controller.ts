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
	Req,
	UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesEnum } from '@gauzy/contracts';
import { RoleGuard, Roles } from '@gauzy/core';
import type { EverConnectConfig } from './ever-connect-config';
import { ConnectResult, EverConnectConnectionService } from './ever-connect-connection.service';
import { ConnectionStatus, EVER_CONNECT_SETTINGS } from './ever-connect.constants';
import { EntitlementImportResult, EverConnectEntitlementService } from './ever-connect-entitlement.service';
import {
	EverConnectIntegrationStateService,
	IntegrationView,
	PublicUrlView
} from './ever-connect-integration-state.service';
import type { RequestWithUser } from './ever-connect-request';
import { EverConnectStore } from './ever-connect.store';
import { EverConnectOperatorGuard } from './guards/ever-connect-operator.guard';
import { MAX_PUBLIC_URL, normalisedPublicAddress } from './public-address';

/** `GET /api/ever-connect/probe`: what the web app's menu needs, for the operator only. */
export interface EverConnectProbe {
	loaded: true;
	/** `ever_cloud` when Ever operates this installation (`EVER_INSTALL_SOURCE=cloud`). */
	managed_by: 'ever_cloud' | 'operator';
	status: ConnectionStatus;
	connected: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The installation side of the Ever Platform connection, for the operator of this installation only
 * (`EverConnectOperatorGuard`): connect, check a connection waiting for approval, replace the key,
 * disconnect, the instance policy, the installation's public address, and the local accept of
 * installation-wide integrations. On Ever's cloud that is a super admin listed by id in
 * `EVER_CONNECT_CLOUD_OPERATOR_USER_IDS`; everyone else, every other tenant administrator of Ever's
 * cloud included, gets 404. No answer is cached.
 */
@ApiTags('Ever Platform')
@ApiBearerAuth()
@Roles(RolesEnum.SUPER_ADMIN)
@UseGuards(EverConnectOperatorGuard, RoleGuard)
@Controller('/ever-connect')
export class EverConnectInstanceController {
	constructor(
		private readonly connection: EverConnectConnectionService,
		private readonly states: EverConnectIntegrationStateService,
		private readonly store: EverConnectStore,
		private readonly entitlements: EverConnectEntitlementService,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig
	) {}

	/**
	 * The web app's menu probe: whether this module is loaded and the caller operates the connection,
	 * and the state of the connection in one word. It answers only the operator (everyone else, and
	 * every caller where the module is not loaded, gets 404, so the menu entry stays hidden), sends
	 * nothing to Ever Platform and carries no id, name or address.
	 */
	@Get('probe')
	@Header('Cache-Control', 'no-store')
	async probe(): Promise<EverConnectProbe> {
		const status = (await this.connection.connection()).status;
		return {
			loaded: true,
			managed_by: this.config.cloud ? 'ever_cloud' : 'operator',
			status,
			connected: status === 'connected'
		};
	}

	/**
	 * Connects this installation with a connect code from app.ever.co: `{ "code": "EVC-…",
	 * "organizationId"?: "<the operator's organization, linked at once when the code names one>" }`.
	 * No name is sent: only the tenant and organization ids of that organization.
	 */
	@Post('connect')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async connect(
		@Req() request: RequestWithUser,
		@Body() body: { code?: unknown; organizationId?: unknown }
	): Promise<ConnectResult> {
		const user = request.user ?? {};
		let tenant: { tenantId: string; organizationId: string } | null = null;
		if (typeof body?.organizationId === 'string' && body.organizationId !== '') {
			if (
				!UUID.test(body.organizationId) ||
				!user.tenantId ||
				!user.id ||
				!(await this.store.isMember(user.tenantId, body.organizationId, user.id))
			) {
				throw new BadRequestException('organizationId must be an organization you belong to.');
			}
			tenant = { tenantId: user.tenantId, organizationId: body.organizationId };
		}
		return this.connection.connect({
			code: typeof body?.code === 'string' ? body.code : '',
			actorLabel: 'operator',
			userId: user.id ?? null,
			tenant
		});
	}

	/** **Check again**: re-reads a connection waiting for approval in app.ever.co, and finishes it once approved. */
	@Post('connection/check')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async check(@Req() request: RequestWithUser): Promise<{ status: string }> {
		return {
			status: await this.connection.checkApproval({ actorLabel: 'operator', userId: request.user?.id ?? null })
		};
	}

	/**
	 * Replaces the connect key (`POST /v1/instances/me/keys` with the SDK's two proofs): for a key
	 * that may have leaked, or as a routine. The installation stays connected.
	 */
	@Post('connection/rotate-key')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async rotateKey(@Req() request: RequestWithUser): Promise<{ kid: string }> {
		return this.connection.rotateKey({ actorLabel: 'operator', userId: request.user?.id ?? null });
	}

	/** Disconnects this installation: `{ "confirm": true }`. */
	@Post('disconnect')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async disconnect(
		@Req() request: RequestWithUser,
		@Body() body: { confirm?: unknown }
	): Promise<{ status: string }> {
		if (body?.confirm !== true) {
			throw new BadRequestException('confirm must be true');
		}
		await this.connection.disconnect({ actorLabel: 'operator', userId: request.user?.id ?? null });
		return { status: (await this.connection.connection()).status };
	}

	/** The instance policy: every integration with allowed or denied, and where the choice comes from. */
	@Get('policy')
	@Header('Cache-Control', 'no-store')
	async policy() {
		return this.states.policyList();
	}

	/** Allows or denies an integration for every organization: `{ "allowed": true | false }`. */
	@Put('policy/:key')
	@Header('Cache-Control', 'no-store')
	async setPolicy(@Req() request: RequestWithUser, @Param('key') key: string, @Body() body: { allowed?: unknown }) {
		if (typeof body?.allowed !== 'boolean') {
			throw new BadRequestException('allowed must be true or false');
		}
		await this.states.setPolicy(key, body.allowed, request.user?.id ?? null);
		return this.states.policyList();
	}

	/**
	 * Accepts or declines an installation-wide integration the connecting organization consented to:
	 * `{ "accepted": true | false }`. The only way such an integration is switched on.
	 */
	@Post('integrations/:key/accept')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async accept(
		@Req() request: RequestWithUser,
		@Param('key') key: string,
		@Body() body: { accepted?: unknown }
	): Promise<IntegrationView> {
		if (typeof body?.accepted !== 'boolean') {
			throw new BadRequestException('accepted must be true or false');
		}
		return this.states.accept(key, body.accepted, request.user?.id ?? null);
	}

	/**
	 * Imports a downloaded entitlement document, for an installation without a route to Ever Platform:
	 * `{ "jws": "<the document>" }` (at most 16 KiB). The checks of a refresh apply; the document must
	 * name this installation or one of its organization links. 409 when not connected, 422 when refused.
	 */
	@Post('entitlement/import')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async importEntitlement(
		@Req() request: RequestWithUser,
		@Body() body: { jws?: unknown }
	): Promise<EntitlementImportResult> {
		return this.entitlements.importDocument(body?.jws, {
			actorLabel: 'operator',
			actorUserId: request.user?.id ?? null
		});
	}

	/**
	 * Reports the installation's public address the operator typed, once "Installation address"
	 * (`instance_url`) is enabled (consented in app.ever.co and accepted here): `{ "url": "https://…" }`.
	 * Never an address read from this server's own host or settings. 409 `not_connected` /
	 * `consent_required` before; 400 `url_invalid` for an address that cannot be published.
	 */
	@Put('public-url')
	@Header('Cache-Control', 'no-store')
	async publicUrl(@Req() request: RequestWithUser, @Body() body: { url?: unknown }): Promise<PublicUrlView> {
		const url = normalisedPublicAddress(body?.url);
		if (!url) {
			throw new BadRequestException({
				statusCode: 400,
				code: 'url_invalid',
				message: `url must be an https address with a host name, without credentials, query or fragment, at most ${MAX_PUBLIC_URL} characters`
			});
		}
		return this.states.setPublicUrl(url, { actorLabel: 'operator', userId: request.user?.id ?? null });
	}

	/** Withdraws the reported address from Ever Platform. */
	@Delete('public-url')
	@Header('Cache-Control', 'no-store')
	async clearPublicUrl(@Req() request: RequestWithUser): Promise<PublicUrlView> {
		return this.states.clearPublicUrl({ actorLabel: 'operator', userId: request.user?.id ?? null });
	}
}
