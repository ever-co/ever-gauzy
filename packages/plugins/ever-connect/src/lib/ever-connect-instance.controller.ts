import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Req,
	UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesEnum } from '@gauzy/contracts';
import { RoleGuard, Roles } from '@gauzy/core';
import { ConnectResult, EverConnectConnectionService } from './ever-connect-connection.service';
import { EverConnectIntegrationStateService, IntegrationView } from './ever-connect-integration-state.service';
import type { RequestWithUser } from './ever-connect-request';
import { EverConnectStore } from './ever-connect.store';
import { EverConnectOperatorGuard } from './guards/ever-connect-operator.guard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The installation side of the Ever Platform connection, for the operator of this installation only
 * (`EverConnectOperatorGuard`): connect, disconnect, the instance policy, the installation's public
 * address, and the local accept of installation-wide integrations. Everyone else, every tenant
 * administrator of Ever's cloud included, gets 404. No answer is cached.
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
		private readonly store: EverConnectStore
	) {}

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

	/** Re-reads a connection waiting for approval in app.ever.co. */
	@Post('connection/check')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async check(): Promise<{ status: string }> {
		return { status: await this.connection.checkApproval() };
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

	/** The installation's public address, once "Installation address" is enabled: `{ "url": "https://…" }`. */
	@Put('public-url')
	@Header('Cache-Control', 'no-store')
	async publicUrl(@Body() body: { url?: unknown }) {
		if (!publicAddress(body?.url)) {
			throw new BadRequestException(
				'url must be an https address with a host name, without credentials, query or fragment'
			);
		}
		return this.states.setPublicUrl(String(body.url));
	}
}

/**
 * Whether `value` may be published as the installation's address: https, a host name (no IP
 * address literal, no credentials, no port 0), no query or fragment.
 */
export function publicAddress(value: unknown): boolean {
	if (typeof value !== 'string' || !/^https:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(value)) {
		return false;
	}
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	const host = url.hostname;
	return (
		url.protocol === 'https:' &&
		!url.username &&
		!url.password &&
		url.port !== '0' &&
		!/^[0-9.]+$/.test(host) &&
		!host.startsWith('[') &&
		host.includes('.')
	);
}
