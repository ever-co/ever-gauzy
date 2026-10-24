import {
	BadGatewayException,
	BadRequestException,
	ForbiddenException,
	HttpStatus,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { IActivepiecesConfig } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import {
	ActivepiecesConnectionMode,
	ActivepiecesSettingName,
	IActivepiecesConnectionModeStatus,
	IActivepiecesListResponse,
	IActivepiecesProject,
	IntegrationEnum
} from '@gauzy/contracts';
import { IntegrationService, IntegrationSettingService, IntegrationTenantService, RequestContext } from '@gauzy/core';
import {
	ACTIVEPIECES_DEFAULT_EXTERNAL_ID_PREFIX,
	ACTIVEPIECES_MANAGED_AUTHN_URL,
	ACTIVEPIECES_PROJECTS_URL
} from './activepieces.config';
import { readJwtExpiry, signExternalToken, tenantExternalTokenClaims } from './activepieces-external-token';

/** A connection mode a request actually runs under. */
export type ActivepiecesResolvedMode = Exclude<ActivepiecesConnectionMode, ActivepiecesConnectionMode.AUTO>;

/**
 * The credential a tenant request reaches Activepieces with.
 *
 * With `enforceProject`, `projectId` is the tenant's own project: every call names it, whatever the client sent, and
 * every resource read, changed or removed by id is checked to belong to it first. Activepieces itself does not confine
 * a platform key: under one, a resource read by id is answered from whichever project of the platform it is in.
 */
export interface IActivepiecesCredential {
	readonly mode: ActivepiecesResolvedMode;
	/** The bearer token. A credential: never log it, never return it. */
	readonly token: string;
	/** The tenant's own project, in the modes that pin one. */
	readonly projectId: string | null;
	readonly enforceProject: boolean;
}

/** What the operator of the installation configured. Never handed to a tenant. */
export interface IActivepiecesOperatorSettings {
	readonly platformApiKey: string;
	readonly signingKeyId: string;
	readonly signingPrivateKey: string;
	readonly tenantProjectsEnabled: boolean;
	readonly externalIdPrefix: string;
}

/** A project token is obtained again when it has less than this left (Activepieces issues them for 7 days). */
export const PROJECT_TOKEN_REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

/** The lifetime assumed for a project token that states no expiry (`managed-authn-service.ts`: 7 days). */
export const PROJECT_TOKEN_DEFAULT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** How long the project found for a tenant's external id is reused before it is looked up again. */
export const TENANT_PROJECT_CACHE_MS = 10 * 60 * 1000;

const ACTIVEPIECES_TIMEOUT_MS = 10_000;

const NOT_CONNECTED =
	'Activepieces is not connected for this tenant: connect an Activepieces API key of your own, or ask the operator of this installation to enable Activepieces.';

/** A project token of a tenant's own project. The token is a credential: never log it, never return it. */
export interface IActivepiecesProjectToken {
	readonly token: string;
	readonly projectId: string;
	readonly expiresAt: number;
}

interface ICachedProject {
	readonly projectId: string;
	readonly expiresAt: number;
}

interface ITenantView {
	readonly tenantId: string;
	readonly rows: any[];
	readonly scoped: any | null;
	readonly requestedMode: ActivepiecesConnectionMode;
	readonly ownApiKey: string | undefined;
	readonly storedProjectId: string | undefined;
}

const RESOLVED_MODES: readonly string[] = [
	ActivepiecesConnectionMode.TENANT_API_KEY,
	ActivepiecesConnectionMode.PROJECT_TOKEN,
	ActivepiecesConnectionMode.PLATFORM_PROJECT
];

/**
 * Decides how each tenant request reaches Activepieces, and holds the operator's credentials.
 *
 * Activepieces API keys belong to a whole platform: there is no project-scoped API key, and a platform key reaches
 * every project, connection and MCP server of the platform. The installation's key (`GAUZY_ACTIVEPIECES_API_KEY`) used
 * to be the silent fallback of every tenant without a key of its own, so such a tenant could list, read, change or
 * remove what any other tenant kept in Activepieces by naming its project or resource. Now a tenant request runs under
 * one of three modes, chosen by the tenant (`connection_mode`) or automatically, in this order:
 *
 * 1. `tenant_api_key`: the tenant's own key (its own platform), as before;
 * 2. `project_token`: a 7-day token of the tenant's own project, obtained with the installation's signing key;
 *    Activepieces confines it to that project;
 * 3. `platform_project`: the installation's key, with the tenant's own project, created once by the server, pinned on
 *    every call and checked on every resource read, changed or removed by id.
 *
 * Nothing else: no tenant request ever runs under the installation's key unconfined. The unconfined key is only for
 * the operator's own routes (`ActivepiecesPlatformController`, behind `EVER_OPERATOR_USER_IDS`).
 */
@Injectable()
export class ActivepiecesCredentialsService {
	private readonly logger = new Logger(ActivepiecesCredentialsService.name);

	private readonly projectTokens = new Map<string, IActivepiecesProjectToken>();
	private readonly pendingProjectTokens = new Map<string, Promise<IActivepiecesProjectToken>>();
	private readonly tenantProjects = new Map<string, ICachedProject>();
	private readonly pendingTenantProjects = new Map<string, Promise<string>>();

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		private readonly integrationService: IntegrationService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly integrationSettingService: IntegrationSettingService
	) {}

	/**
	 * What the operator configured (`GAUZY_ACTIVEPIECES_*`).
	 */
	operatorSettings(): IActivepiecesOperatorSettings {
		let config: IActivepiecesConfig = {};
		try {
			config = this.configService.get('activepieces') ?? {};
		} catch {
			config = {};
		}
		const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
		return {
			platformApiKey: text(config.apiKey),
			signingKeyId: text(config.signingKeyId),
			signingPrivateKey: text(config.signingPrivateKey),
			tenantProjectsEnabled: config.tenantProjectsEnabled !== false,
			externalIdPrefix: text(config.projectExternalIdPrefix) || ACTIVEPIECES_DEFAULT_EXTERNAL_ID_PREFIX
		};
	}

	/** Whether the operator configured the signing key that project tokens need. */
	isProjectTokenAvailable(settings: IActivepiecesOperatorSettings = this.operatorSettings()): boolean {
		return !!settings.signingKeyId && !!settings.signingPrivateKey;
	}

	/** Whether tenants may use the platform key, confined to a project of their own. */
	isPlatformProjectAvailable(settings: IActivepiecesOperatorSettings = this.operatorSettings()): boolean {
		return !!settings.platformApiKey && settings.tenantProjectsEnabled;
	}

	/** The external id of the tenant's Activepieces project (and of its Activepieces user): `<prefix><tenantId>`. */
	tenantExternalId(tenantId: string, settings: IActivepiecesOperatorSettings = this.operatorSettings()): string {
		return `${settings.externalIdPrefix}${tenantId}`;
	}

	/**
	 * The credential of the current tenant's request.
	 *
	 * @param options.integrationTenantId - The tenant's integration row the request is about, when it names one. A row
	 * of another tenant is never read: the rows are those of the tenant in context.
	 * @param options.organizationId - The organization the request is about, when it names one.
	 * @throws BadRequestException when the tenant has no way to reach Activepieces, or chose one that is not available.
	 */
	async resolve(options: { integrationTenantId?: string; organizationId?: string } = {}): Promise<IActivepiecesCredential> {
		const settings = this.operatorSettings();
		const view = await this.tenantView(this.currentTenantId(), options);
		const mode =
			view.requestedMode === ActivepiecesConnectionMode.AUTO
				? this.automaticMode(!!view.ownApiKey, settings)
				: view.requestedMode;

		switch (mode) {
			case ActivepiecesConnectionMode.TENANT_API_KEY:
				if (!view.ownApiKey) {
					throw new BadRequestException(
						'This tenant has no Activepieces API key of its own: connect one, or choose another connection mode.'
					);
				}
				return { mode, token: view.ownApiKey, projectId: null, enforceProject: false };

			case ActivepiecesConnectionMode.PROJECT_TOKEN: {
				if (!this.isProjectTokenAvailable(settings)) {
					throw new BadRequestException(this.unavailable(mode));
				}
				const { token, projectId } = await this.projectToken(view.tenantId, settings);
				await this.rememberProject(view, projectId);
				return { mode, token, projectId, enforceProject: true };
			}

			case ActivepiecesConnectionMode.PLATFORM_PROJECT: {
				if (!this.isPlatformProjectAvailable(settings)) {
					throw new BadRequestException(this.unavailable(mode));
				}
				const projectId = await this.tenantProject(view.tenantId, settings);
				await this.rememberProject(view, projectId);
				return { mode, token: settings.platformApiKey, projectId, enforceProject: true };
			}

			default:
				throw new BadRequestException(NOT_CONNECTED);
		}
	}

	/**
	 * The project a call names: the tenant's own when the credential pins one, refusing any other the client named;
	 * otherwise the client's, which the tenant's own key confines to the tenant's own platform.
	 *
	 * @param credential - The request's credential.
	 * @param requested - The project the client named, if any.
	 * @throws ForbiddenException when the client named another project than the tenant's own.
	 * @throws BadRequestException when no project is known.
	 */
	projectFor(credential: IActivepiecesCredential, requested?: string | null): string {
		const named = typeof requested === 'string' ? requested.trim() : '';
		if (credential.enforceProject) {
			if (named && named !== credential.projectId) {
				throw new ForbiddenException(
					`This tenant's Activepieces project is ${credential.projectId}: another project cannot be used.`
				);
			}
			return credential.projectId as string;
		}
		if (!named) {
			throw new BadRequestException('projectId is required');
		}
		return named;
	}

	/**
	 * Whether a resource is in the tenant's own project, when the credential pins one (always true otherwise).
	 *
	 * @param credential - The request's credential.
	 * @param projectIds - The resource's project id, or ids (an app connection lists several).
	 */
	isInProject(credential: IActivepiecesCredential, projectIds: unknown): boolean {
		if (!credential.enforceProject) {
			return true;
		}
		const ids = Array.isArray(projectIds) ? projectIds : [projectIds];
		return ids.some((id) => typeof id === 'string' && id === credential.projectId);
	}

	/**
	 * Refuses a resource outside the tenant's own project, before it is returned, changed or removed. The answer is the
	 * one a missing resource gets, so another tenant's resources are not confirmed to exist.
	 *
	 * @throws NotFoundException
	 */
	assertInProject(credential: IActivepiecesCredential, projectIds: unknown, what: string): void {
		if (!this.isInProject(credential, projectIds)) {
			throw new NotFoundException(`${what} not found`);
		}
	}

	/**
	 * The current tenant's connection, for display. Never a secret, and it creates nothing.
	 *
	 * @param organizationId - The organization asked about, if any.
	 */
	async describe(organizationId?: string): Promise<IActivepiecesConnectionModeStatus> {
		const settings = this.operatorSettings();
		const view = await this.tenantView(this.currentTenantId(), { organizationId });
		const availableModes = this.availableModes(!!view.ownApiKey, settings);

		let resolvedMode: ActivepiecesResolvedMode | null;
		if (view.requestedMode === ActivepiecesConnectionMode.AUTO) {
			resolvedMode = this.automaticMode(!!view.ownApiKey, settings);
		} else {
			resolvedMode = availableModes.includes(view.requestedMode) ? (view.requestedMode as ActivepiecesResolvedMode) : null;
		}

		let projectId: string | null = null;
		if (resolvedMode === ActivepiecesConnectionMode.PROJECT_TOKEN) {
			projectId = this.projectTokens.get(view.tenantId)?.projectId ?? view.storedProjectId ?? null;
		} else if (resolvedMode === ActivepiecesConnectionMode.PLATFORM_PROJECT) {
			projectId = this.tenantProjects.get(view.tenantId)?.projectId ?? view.storedProjectId ?? null;
		}

		return {
			requestedMode: view.requestedMode,
			resolvedMode,
			availableModes,
			hasOwnApiKey: !!view.ownApiKey,
			projectId
		};
	}

	/**
	 * Saves the current tenant's choice of connection mode, on its tenant-level integration row, or on the
	 * organization's row when one is named.
	 *
	 * @throws BadRequestException when the mode is not available to the tenant on this installation.
	 */
	async setMode(mode: ActivepiecesConnectionMode, organizationId?: string): Promise<IActivepiecesConnectionModeStatus> {
		const settings = this.operatorSettings();
		const tenantId = this.currentTenantId();
		const view = await this.tenantView(tenantId, { organizationId });

		if (!Object.values(ActivepiecesConnectionMode).includes(mode)) {
			throw new BadRequestException('Unknown Activepieces connection mode');
		}
		if (mode !== ActivepiecesConnectionMode.AUTO && !this.availableModes(!!view.ownApiKey, settings).includes(mode)) {
			throw new BadRequestException(this.unavailable(mode));
		}

		const setting = { settingsName: ActivepiecesSettingName.CONNECTION_MODE, settingsValue: mode, tenantId, organizationId };
		const target = organizationId
			? view.rows.find((row) => row.organizationId === organizationId) ?? null
			: view.rows.find((row) => !row.organizationId) ?? null;

		if (target) {
			await this.saveMergedSettings(target, [setting]);
		} else {
			await this.createIntegrationTenant(tenantId, organizationId, [setting]);
		}
		this.logger.log(`Activepieces connection mode of tenant ${tenantId} set to ${mode}`);
		return this.describe(organizationId);
	}

	/**
	 * A project token of the tenant's own project, obtained again when it has less than a day left.
	 *
	 * @param tenantId - The tenant.
	 * @param settings - The operator's settings.
	 */
	async projectToken(
		tenantId: string,
		settings: IActivepiecesOperatorSettings = this.operatorSettings()
	): Promise<IActivepiecesProjectToken> {
		const cached = this.projectTokens.get(tenantId);
		if (cached && cached.expiresAt - Date.now() > PROJECT_TOKEN_REFRESH_MARGIN_MS) {
			return cached;
		}
		const pending = this.pendingProjectTokens.get(tenantId);
		if (pending) {
			return pending;
		}
		const obtaining = this.obtainProjectToken(tenantId, settings).finally(() =>
			this.pendingProjectTokens.delete(tenantId)
		);
		this.pendingProjectTokens.set(tenantId, obtaining);
		return obtaining;
	}

	/**
	 * The id of the tenant's own project on the operator's platform, found by its external id, or created once.
	 *
	 * Two servers creating it at the same moment can leave a second, empty project with the same external id: the
	 * oldest one is always the one used.
	 *
	 * @param tenantId - The tenant.
	 * @param settings - The operator's settings.
	 */
	async tenantProject(tenantId: string, settings: IActivepiecesOperatorSettings = this.operatorSettings()): Promise<string> {
		const cached = this.tenantProjects.get(tenantId);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.projectId;
		}
		const pending = this.pendingTenantProjects.get(tenantId);
		if (pending) {
			return pending;
		}
		const finding = (async () => {
			const externalId = this.tenantExternalId(tenantId, settings);
			const project =
				(await this.findProjectByExternalId(externalId, settings.platformApiKey)) ??
				(await this.createTenantProject(tenantId, externalId, settings.platformApiKey));
			this.tenantProjects.set(tenantId, { projectId: project.id, expiresAt: Date.now() + TENANT_PROJECT_CACHE_MS });
			return project.id;
		})().finally(() => this.pendingTenantProjects.delete(tenantId));
		this.pendingTenantProjects.set(tenantId, finding);
		return finding;
	}

	/**
	 * The oldest project of the operator's platform holding an external id.
	 *
	 * @param externalId - The external id.
	 * @param platformApiKey - The operator's platform key.
	 */
	async findProjectByExternalId(externalId: string, platformApiKey: string): Promise<IActivepiecesProject | null> {
		const page = await this.requestActivepieces<IActivepiecesListResponse<IActivepiecesProject>>(
			'get',
			ACTIVEPIECES_PROJECTS_URL,
			platformApiKey,
			'list the projects of the platform',
			{ params: { externalId, limit: 100 } }
		);
		const matches = (page?.data ?? []).filter(
			(project) => typeof project?.id === 'string' && project.externalId === externalId
		);
		matches.sort((a, b) => String(a.created ?? '').localeCompare(String(b.created ?? '')));
		return matches[0] ?? null;
	}

	/** Drops what this server remembers of a tenant's project and token, so the next request looks them up again. */
	forgetTenant(tenantId: string): void {
		this.projectTokens.delete(tenantId);
		this.tenantProjects.delete(tenantId);
	}

	/**
	 * One call to the Activepieces API. On failure only the status is logged: the request carries a credential, and an
	 * HTTP client error holds the request's headers.
	 *
	 * @param method - The HTTP method.
	 * @param url - The URL.
	 * @param bearer - The bearer token, if the endpoint takes one.
	 * @param action - What the call does, for the messages ("list the projects of the platform").
	 * @param options.data - The body.
	 * @param options.params - The query.
	 */
	async requestActivepieces<T>(
		method: 'get' | 'post' | 'delete',
		url: string,
		bearer: string | undefined,
		action: string,
		options: { data?: unknown; params?: Record<string, unknown> } = {}
	): Promise<T> {
		try {
			const response = await firstValueFrom(
				this.httpService.request<T>({
					method,
					url,
					data: options.data,
					params: options.params,
					timeout: ACTIVEPIECES_TIMEOUT_MS,
					headers: {
						'Content-Type': 'application/json',
						...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
					}
				})
			);
			return response.data;
		} catch (error: unknown) {
			const status = (error as AxiosError)?.response?.status;
			this.logger.error(`Activepieces could not ${action}${status ? ` (HTTP ${status})` : ''}`);
			if (status === HttpStatus.NOT_FOUND) {
				throw new NotFoundException(`Activepieces could not ${action}: not found.`);
			}
			if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
				throw new BadGatewayException(`Activepieces refused to ${action}: the credentials were not accepted.`);
			}
			throw new BadGatewayException(`Activepieces could not ${action}.`);
		}
	}

	/**
	 * Merges settings into an integration row by name: matching rows are updated in place, missing ones added. Only the
	 * given settings are written.
	 */
	async saveMergedSettings(existingTenant: any, settings: any[]): Promise<void> {
		const existingSettings: any[] = existingTenant.settings ?? [];
		const settingsByName = new Map(settings.map((s) => [s.settingsName, s]));

		const updatedNames = new Set<string>();
		const rows: any[] = [];
		for (const existing of existingSettings) {
			const update = settingsByName.get(existing.settingsName);
			if (update) {
				updatedNames.add(existing.settingsName);
				rows.push({ ...existing, settingsValue: update.settingsValue });
			}
		}

		for (const [name, setting] of settingsByName) {
			if (!updatedNames.has(name)) {
				rows.push({ ...setting, integration: { id: existingTenant.id } });
			}
		}

		await this.integrationSettingService.saveMany(rows);
	}

	private async obtainProjectToken(
		tenantId: string,
		settings: IActivepiecesOperatorSettings
	): Promise<IActivepiecesProjectToken> {
		const externalId = this.tenantExternalId(tenantId, settings);

		let externalAccessToken: string;
		try {
			externalAccessToken = signExternalToken(
				settings.signingKeyId,
				settings.signingPrivateKey,
				tenantExternalTokenClaims(externalId, Math.floor(Date.now() / 1000))
			);
		} catch {
			this.logger.error('GAUZY_ACTIVEPIECES_SIGNING_PRIVATE_KEY is not a usable RS256 private key');
			throw new InternalServerErrorException('Activepieces project tokens are misconfigured on this installation.');
		}

		const answer = await this.requestActivepieces<{ token?: unknown; projectId?: unknown }>(
			'post',
			ACTIVEPIECES_MANAGED_AUTHN_URL,
			undefined,
			'issue a project token',
			{ data: { externalAccessToken } }
		);
		if (typeof answer?.token !== 'string' || !answer.token || typeof answer?.projectId !== 'string' || !answer.projectId) {
			throw new BadGatewayException('Activepieces did not issue a project token.');
		}

		const entry: IActivepiecesProjectToken = {
			token: answer.token,
			projectId: answer.projectId,
			expiresAt: readJwtExpiry(answer.token) ?? Date.now() + PROJECT_TOKEN_DEFAULT_LIFETIME_MS
		};
		this.projectTokens.set(tenantId, entry);
		return entry;
	}

	private async createTenantProject(tenantId: string, externalId: string, platformApiKey: string): Promise<IActivepiecesProject> {
		const project = await this.requestActivepieces<IActivepiecesProject>(
			'post',
			ACTIVEPIECES_PROJECTS_URL,
			platformApiKey,
			'create the project of the tenant',
			{ data: { displayName: `Ever Gauzy ${tenantId}`, externalId, metadata: { source: 'ever-gauzy', tenantId } } }
		);
		if (typeof project?.id !== 'string' || !project.id) {
			throw new BadGatewayException('Activepieces did not return the project it created.');
		}
		this.logger.log(`Created Activepieces project ${project.id} for tenant ${tenantId}`);
		return project;
	}

	/**
	 * The tenant's Activepieces integration rows, the one the request is about, the mode chosen, the tenant's own key.
	 * The rows are read for the tenant in context only.
	 */
	private async tenantView(
		tenantId: string,
		options: { integrationTenantId?: string; organizationId?: string }
	): Promise<ITenantView> {
		const rows: any[] =
			(await this.integrationTenantService.find({
				where: {
					tenantId,
					integration: { provider: IntegrationEnum.ACTIVE_PIECES }
				},
				relations: ['settings']
			})) ?? [];

		let scoped: any | null = null;
		if (options.integrationTenantId) {
			scoped = rows.find((row) => row.id === options.integrationTenantId) ?? null;
		} else if (options.organizationId) {
			const organizationRows = rows.filter((row) => row.organizationId === options.organizationId);
			scoped = organizationRows.find((row) => !!settingOf(row, ActivepiecesSettingName.API_KEY)) ?? organizationRows[0] ?? null;
		}

		const ordered = [scoped, ...rows.filter((row) => !row.organizationId), ...rows].filter(Boolean);
		const requested = firstSetting(ordered, ActivepiecesSettingName.CONNECTION_MODE);

		return {
			tenantId,
			rows,
			scoped,
			requestedMode: parseMode(requested),
			// As before: the key of the row the request is about, else the key of any of the tenant's rows
			ownApiKey: settingOf(scoped, ActivepiecesSettingName.API_KEY) ?? firstSetting(rows, ActivepiecesSettingName.API_KEY),
			storedProjectId: firstSetting(ordered, ActivepiecesSettingName.MANAGED_PROJECT_ID)
		};
	}

	/** Own key first, then a project token, then the platform key confined to the tenant's project. */
	private automaticMode(hasOwnApiKey: boolean, settings: IActivepiecesOperatorSettings): ActivepiecesResolvedMode | null {
		if (hasOwnApiKey) {
			return ActivepiecesConnectionMode.TENANT_API_KEY;
		}
		if (this.isProjectTokenAvailable(settings)) {
			return ActivepiecesConnectionMode.PROJECT_TOKEN;
		}
		if (this.isPlatformProjectAvailable(settings)) {
			return ActivepiecesConnectionMode.PLATFORM_PROJECT;
		}
		return null;
	}

	private availableModes(hasOwnApiKey: boolean, settings: IActivepiecesOperatorSettings): ActivepiecesConnectionMode[] {
		const modes: ActivepiecesConnectionMode[] = [ActivepiecesConnectionMode.AUTO];
		if (hasOwnApiKey) {
			modes.push(ActivepiecesConnectionMode.TENANT_API_KEY);
		}
		if (this.isProjectTokenAvailable(settings)) {
			modes.push(ActivepiecesConnectionMode.PROJECT_TOKEN);
		}
		if (this.isPlatformProjectAvailable(settings)) {
			modes.push(ActivepiecesConnectionMode.PLATFORM_PROJECT);
		}
		return modes;
	}

	/** Records the tenant's project on its tenant-level row, when it changed. A failure here never fails the request. */
	private async rememberProject(view: ITenantView, projectId: string): Promise<void> {
		if (!projectId || view.storedProjectId === projectId) {
			return;
		}
		const target =
			view.rows.find((row) => !row.organizationId) ?? view.scoped ?? view.rows[0] ?? null;
		if (!target) {
			return;
		}
		try {
			await this.saveMergedSettings(target, [
				{
					settingsName: ActivepiecesSettingName.MANAGED_PROJECT_ID,
					settingsValue: projectId,
					tenantId: view.tenantId,
					organizationId: target.organizationId ?? undefined
				}
			]);
		} catch (error: any) {
			this.logger.warn(`Could not record the Activepieces project of tenant ${view.tenantId}: ${error?.message}`);
		}
	}

	private async createIntegrationTenant(tenantId: string, organizationId: string | undefined, settings: any[]): Promise<void> {
		let integration: any = null;
		try {
			integration = await this.integrationService.findOneByOptions({
				where: { provider: IntegrationEnum.ACTIVE_PIECES }
			});
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}
		if (!integration) {
			integration = await this.integrationService.create({
				provider: IntegrationEnum.ACTIVE_PIECES,
				name: IntegrationEnum.ACTIVE_PIECES
			});
		}
		await this.integrationTenantService.create({
			name: IntegrationEnum.ACTIVE_PIECES,
			integration,
			tenantId,
			organizationId,
			settings
		});
	}

	private unavailable(mode: ActivepiecesConnectionMode): string {
		switch (mode) {
			case ActivepiecesConnectionMode.TENANT_API_KEY:
				return 'This tenant has no Activepieces API key of its own: connect one first.';
			case ActivepiecesConnectionMode.PROJECT_TOKEN:
				return 'Activepieces project tokens are not enabled on this installation.';
			case ActivepiecesConnectionMode.PLATFORM_PROJECT:
				return 'Activepieces projects for tenants are not enabled on this installation.';
			default:
				return 'This Activepieces connection mode is not available.';
		}
	}

	private currentTenantId(): string {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new BadRequestException('Tenant ID not found in request context');
		}
		return tenantId;
	}
}

function settingOf(row: any, name: string): string | undefined {
	const value = row?.settings?.find((setting: any) => setting?.settingsName === name && setting.settingsValue)?.settingsValue;
	return typeof value === 'string' && value ? value : undefined;
}

function firstSetting(rows: any[], name: string): string | undefined {
	for (const row of rows) {
		const value = settingOf(row, name);
		if (value) {
			return value;
		}
	}
	return undefined;
}

function parseMode(value: string | undefined): ActivepiecesConnectionMode {
	const mode = typeof value === 'string' ? value.trim() : '';
	return RESOLVED_MODES.includes(mode) ? (mode as ActivepiecesConnectionMode) : ActivepiecesConnectionMode.AUTO;
}
