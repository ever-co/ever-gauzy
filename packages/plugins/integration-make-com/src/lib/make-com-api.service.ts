import { Injectable, Logger, BadRequestException, NotFoundException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { firstValueFrom, catchError } from 'rxjs';
import { IntegrationEnum } from '@gauzy/contracts';
import { IntegrationSettingService, IntegrationTenantService, RequestContext, IntegrationTenant } from '@gauzy/core';
import { MakeSettingName } from './interfaces/make-com.model';
import {
	getMakeApiBaseUrl,
	IMakeComOrganization,
	IMakeComTeam,
	IMakeComConnection,
	IMakeComScenario,
	IMakeComHook,
	IMakeComTemplate,
	IMakeComCreateScenarioParams,
	IMakeComUpdateScenarioParams,
	IMakeComCreateHookParams,
	IMakeComPaginationParams,
	MakeComZone
} from './interfaces/make-com-api.model';
import { MakeComOAuthService } from './make-com-oauth.service';

/**
 * Service for interacting with the Make.com REST API v2.
 *
 * Handles zone-based URL resolution, token authentication (with auto-refresh),
 * and provides methods for each Make.com resource.
 *
 * @see https://developers.make.com/api-documentation/api-reference
 */
@Injectable()
export class MakeComApiService {
	private readonly logger = new Logger(MakeComApiService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly integrationSettingService: IntegrationSettingService,
		private readonly makeComOAuthService: MakeComOAuthService
	) {}

	// ─── Internal Helpers ────────────────────────────────────────────────────

	/**
	 * Resolve the integration tenant for the current request context.
	 */
	private async getIntegrationTenant(organizationId?: string) {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new NotFoundException('Tenant ID not found in request context');
		}

		const where: any = { name: IntegrationEnum.MakeCom, tenantId };
		if (organizationId) {
			where.organizationId = organizationId;
		}

		const tenant = await this.integrationTenantService.findOneByOptions({
			where,
			relations: ['settings']
		});

		if (!tenant) {
			throw new NotFoundException('Make.com integration not found for this tenant');
		}
		return tenant;
	}

	/**
	 * Read a single setting value from the integration tenant.
	 */
	private getSettingValue(integrationTenant: IntegrationTenant, name: string): string | null {
		const setting = integrationTenant.settings?.find((s) => s.settingsName === name);
		return setting?.settingsValue ?? null;
	}

	/**
	 * Get the access token, refreshing if expired.
	 */
	private async getValidAccessToken(integrationTenant: IntegrationTenant): Promise<string> {
		const accessToken = this.getSettingValue(integrationTenant, MakeSettingName.ACCESS_TOKEN);
		const expiresAt = this.getSettingValue(integrationTenant, MakeSettingName.EXPIRES_AT);

		if (!accessToken) {
			throw new BadRequestException('Make.com access token not found. Please authorize first.');
		}

		// Check if the token is expired or about to expire (30s buffer)
		if (expiresAt && new Date(expiresAt).getTime() - 30_000 < Date.now()) {
			this.logger.log('Access token expired or near expiry, refreshing...');
			await this.makeComOAuthService.refreshToken(integrationTenant.id);

			// Re-read the updated settings
			const updated = await this.integrationTenantService.findOneByOptions({
				where: { id: integrationTenant.id },
				relations: ['settings']
			});
			const newToken = this.getSettingValue(updated, MakeSettingName.ACCESS_TOKEN);
			if (!newToken) {
				throw new BadRequestException('Failed to refresh Make.com access token');
			}
			return newToken;
		}

		return accessToken;
	}

	/**
	 * Resolve the zone API base URL.
	 */
	private getZoneBaseUrl(integrationTenant: IntegrationTenant): string {
		const zone = this.getSettingValue(integrationTenant, MakeSettingName.ZONE) as MakeComZone;
		if (!zone) {
			throw new BadRequestException(
				'Make.com zone is not configured. Please set your zone (e.g., "us2", "eu1") first.'
			);
		}
		return getMakeApiBaseUrl(zone);
	}

	/**
	 * Execute an authenticated request to the Make.com API.
	 */
	private async request<T>(
		method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
		path: string,
		integrationTenant: IntegrationTenant,
		options?: { data?: any; params?: Record<string, any> }
	): Promise<T> {
		const baseUrl = this.getZoneBaseUrl(integrationTenant);
		const accessToken = await this.getValidAccessToken(integrationTenant);

		const config: AxiosRequestConfig = {
			method,
			url: `${baseUrl}${path}`,
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			params: options?.params,
			data: options?.data,
			timeout: 15_000
		};

		try {
			const response = await firstValueFrom(
				this.httpService.request<T>(config).pipe(
					catchError((error: AxiosError) => {
						const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
						const data = error.response?.data as any;
						const msg = data?.message || error.message;
						this.logger.error(`Make.com API ${method} ${path} failed [${status}]: ${msg}`);
						if (status === 401) {
							throw new UnauthorizedException(`Make.com authentication failed: ${msg}`);
						}
						if (status === 404) {
							throw new NotFoundException(`Make.com resource not found: ${msg}`);
						}
						throw new HttpException(`Make.com API error: ${msg}`, status);
					})
				)
			);
			return response.data;
		} catch (error) {
			if (error instanceof HttpException) throw error;
			this.logger.error(`Unexpected error calling Make.com API: ${error.message}`);
			throw new HttpException(`Make.com API error: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Build pagination query params.
	 */
	private buildPaginationParams(pagination?: IMakeComPaginationParams): Record<string, any> {
		if (!pagination) return {};
		const params: Record<string, any> = {};
		if (pagination['pg[offset]'] != null) params['pg[offset]'] = pagination['pg[offset]'];
		if (pagination['pg[limit]'] != null) params['pg[limit]'] = pagination['pg[limit]'];
		if (pagination['pg[sortBy]']) params['pg[sortBy]'] = pagination['pg[sortBy]'];
		if (pagination['pg[sortDir]']) params['pg[sortDir]'] = pagination['pg[sortDir]'];
		return params;
	}

	// ─── Zone & Context Management ──────────────────────────────────────────

	/**
	 * Set the Make.com zone for the current tenant.
	 */
	async setZone(zone: MakeComZone, organizationId?: string): Promise<void> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const existing = tenant.settings?.find((s) => s.settingsName === MakeSettingName.ZONE);

		if (existing) {
			existing.settingsValue = zone;
			await this.integrationSettingService.save(existing);
		} else {
			await this.integrationSettingService.save({
				settingsName: MakeSettingName.ZONE,
				settingsValue: zone,
				integration: tenant
			} as any);
		}
		this.logger.log(`Make.com zone set to "${zone}" for tenant ${tenant.tenantId}`);
	}

	/**
	 * Get the current zone for the tenant.
	 */
	async getZone(organizationId?: string): Promise<string | null> {
		const tenant = await this.getIntegrationTenant(organizationId);
		return this.getSettingValue(tenant, MakeSettingName.ZONE);
	}

	/**
	 * Store the Make.com organization ID for this tenant.
	 */
	async setMakeOrganizationId(makeOrgId: number, organizationId?: string): Promise<void> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const existing = tenant.settings?.find((s) => s.settingsName === MakeSettingName.MAKE_ORGANIZATION_ID);

		if (existing) {
			existing.settingsValue = makeOrgId.toString();
			await this.integrationSettingService.save(existing);
		} else {
			await this.integrationSettingService.save({
				settingsName: MakeSettingName.MAKE_ORGANIZATION_ID,
				settingsValue: makeOrgId.toString(),
				integration: tenant
			} as any);
		}
	}

	/**
	 * Store the Make.com team ID for this tenant.
	 */
	async setMakeTeamId(makeTeamId: number, organizationId?: string): Promise<void> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const existing = tenant.settings?.find((s) => s.settingsName === MakeSettingName.MAKE_TEAM_ID);

		if (existing) {
			existing.settingsValue = makeTeamId.toString();
			await this.integrationSettingService.save(existing);
		} else {
			await this.integrationSettingService.save({
				settingsName: MakeSettingName.MAKE_TEAM_ID,
				settingsValue: makeTeamId.toString(),
				integration: tenant
			} as any);
		}
	}

	/**
	 * Get the current setup status: zone, orgId, teamId, and whether an access token exists.
	 */
	async getSetupStatus(organizationId?: string): Promise<{
		hasAccessToken: boolean;
		zone: MakeComZone | null;
		makeOrganizationId: number | null;
		makeTeamId: number | null;
		isComplete: boolean;
	}> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const accessToken = this.getSettingValue(tenant, MakeSettingName.ACCESS_TOKEN);
		const zone = this.getSettingValue(tenant, MakeSettingName.ZONE);
		const makeOrgId = this.getSettingValue(tenant, MakeSettingName.MAKE_ORGANIZATION_ID);
		const makeTeamId = this.getSettingValue(tenant, MakeSettingName.MAKE_TEAM_ID);

		const parsedOrgId = makeOrgId ? parseInt(makeOrgId, 10) : null;
		const parsedTeamId = makeTeamId ? parseInt(makeTeamId, 10) : null;

		return {
			hasAccessToken: !!accessToken,
			zone: zone as MakeComZone | null,
			makeOrganizationId: parsedOrgId !== null && !isNaN(parsedOrgId) ? parsedOrgId : null,
			makeTeamId: parsedTeamId !== null && !isNaN(parsedTeamId) ? parsedTeamId : null,
			isComplete: !!accessToken && !!zone && !!makeOrgId && !!makeTeamId
		};
	}

	/**
	 * Read the stored Make.com organization ID.
	 */
	private async getMakeOrganizationId(integrationTenant: IntegrationTenant): Promise<number> {
		const value = this.getSettingValue(integrationTenant, MakeSettingName.MAKE_ORGANIZATION_ID);
		if (!value) {
			throw new BadRequestException('Make.com organization ID is not configured. Please select an organization first.');
		}
		const parsed = parseInt(value, 10);
		if (isNaN(parsed)) {
			throw new BadRequestException('Invalid Make.com organization ID stored in settings.');
		}
		return parsed;
	}

	/**
	 * Read the stored Make.com team ID.
	 */
	private async getMakeTeamId(integrationTenant: IntegrationTenant): Promise<number> {
		const value = this.getSettingValue(integrationTenant, MakeSettingName.MAKE_TEAM_ID);
		if (!value) {
			throw new BadRequestException('Make.com team ID is not configured. Please select a team first.');
		}
		const parsed = parseInt(value, 10);
		if (isNaN(parsed)) {
			throw new BadRequestException('Invalid Make.com team ID stored in settings.');
		}
		return parsed;
	}

	// ─── Organizations ──────────────────────────────────────────────────────

	/**
	 * List organizations the authenticated user has access to.
	 */
	async listOrganizations(organizationId?: string): Promise<IMakeComOrganization[]> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ organizations: IMakeComOrganization[] }>(
			'GET', '/organizations', tenant
		);
		return result.organizations;
	}

	/**
	 * Get a single organization by its Make.com ID.
	 */
	async getOrganization(makeOrgId: number, organizationId?: string): Promise<IMakeComOrganization> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ organization: IMakeComOrganization }>(
			'GET', `/organizations/${makeOrgId}`, tenant
		);
		return result.organization;
	}

	// ─── Teams ──────────────────────────────────────────────────────────────

	/**
	 * List teams within a Make.com organization.
	 */
	async listTeams(
		makeOrgId?: number,
		organizationId?: string,
		pagination?: IMakeComPaginationParams
	): Promise<IMakeComTeam[]> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const orgId = makeOrgId ?? await this.getMakeOrganizationId(tenant);
		const params = { organizationId: orgId, ...this.buildPaginationParams(pagination) };
		const result = await this.request<{ teams: IMakeComTeam[] }>(
			'GET', '/teams', tenant, { params }
		);
		return result.teams;
	}

	/**
	 * Get a single team by ID.
	 */
	async getTeam(teamId: number, organizationId?: string): Promise<IMakeComTeam> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ team: IMakeComTeam }>(
			'GET', `/teams/${teamId}`, tenant
		);
		return result.team;
	}

	// ─── Connections ────────────────────────────────────────────────────────

	/**
	 * List connections for a team.
	 */
	async listConnections(
		teamId?: number,
		organizationId?: string,
		pagination?: IMakeComPaginationParams
	): Promise<IMakeComConnection[]> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const resolvedTeamId = teamId ?? await this.getMakeTeamId(tenant);
		const params = { teamId: resolvedTeamId, ...this.buildPaginationParams(pagination) };
		const result = await this.request<{ connections: IMakeComConnection[] }>(
			'GET', '/connections', tenant, { params }
		);
		return result.connections;
	}

	/**
	 * Get a single connection by ID.
	 */
	async getConnection(connectionId: number, organizationId?: string): Promise<IMakeComConnection> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ connection: IMakeComConnection }>(
			'GET', `/connections/${connectionId}`, tenant
		);
		return result.connection;
	}

	/**
	 * Delete a connection.
	 */
	async deleteConnection(connectionId: number, organizationId?: string): Promise<void> {
		const tenant = await this.getIntegrationTenant(organizationId);
		await this.request<void>('DELETE', `/connections/${connectionId}`, tenant);
	}

	/**
	 * Test (verify) a connection.
	 */
	async testConnection(connectionId: number, organizationId?: string): Promise<any> {
		const tenant = await this.getIntegrationTenant(organizationId);
		return this.request<any>('POST', `/connections/${connectionId}/test`, tenant);
	}

	// ─── Scenarios ──────────────────────────────────────────────────────────

	/**
	 * List scenarios for a team.
	 */
	async listScenarios(
		teamId?: number,
		organizationId?: string,
		pagination?: IMakeComPaginationParams
	): Promise<IMakeComScenario[]> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const resolvedTeamId = teamId ?? await this.getMakeTeamId(tenant);
		const params = { teamId: resolvedTeamId, ...this.buildPaginationParams(pagination) };
		const result = await this.request<{ scenarios: IMakeComScenario[] }>(
			'GET', '/scenarios', tenant, { params }
		);
		return result.scenarios;
	}

	/**
	 * Get a single scenario by ID.
	 */
	async getScenario(scenarioId: number, organizationId?: string): Promise<IMakeComScenario> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ scenario: IMakeComScenario }>(
			'GET', `/scenarios/${scenarioId}`, tenant
		);
		return result.scenario;
	}

	/**
	 * Create a new scenario.
	 */
	async createScenario(params: IMakeComCreateScenarioParams, organizationId?: string): Promise<IMakeComScenario> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ scenario: IMakeComScenario }>(
			'POST', '/scenarios', tenant, { data: params }
		);
		return result.scenario;
	}

	/**
	 * Update a scenario.
	 */
	async updateScenario(
		scenarioId: number,
		params: IMakeComUpdateScenarioParams,
		organizationId?: string
	): Promise<IMakeComScenario> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ scenario: IMakeComScenario }>(
			'PATCH', `/scenarios/${scenarioId}`, tenant, { data: params }
		);
		return result.scenario;
	}

	/**
	 * Delete a scenario.
	 */
	async deleteScenario(scenarioId: number, organizationId?: string, confirmed = true): Promise<void> {
		const tenant = await this.getIntegrationTenant(organizationId);
		await this.request<void>('DELETE', `/scenarios/${scenarioId}`, tenant, {
			params: { confirmed }
		});
	}

	/**
	 * Activate (start) a scenario.
	 */
	async startScenario(scenarioId: number, organizationId?: string): Promise<IMakeComScenario> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ scenario: IMakeComScenario }>(
			'POST', `/scenarios/${scenarioId}/start`, tenant
		);
		return result.scenario;
	}

	/**
	 * Deactivate (stop) a scenario.
	 */
	async stopScenario(scenarioId: number, organizationId?: string): Promise<IMakeComScenario> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ scenario: IMakeComScenario }>(
			'POST', `/scenarios/${scenarioId}/stop`, tenant
		);
		return result.scenario;
	}

	/**
	 * Run a scenario on demand.
	 */
	async runScenario(
		scenarioId: number,
		organizationId?: string,
		options?: { responsive?: boolean; data?: any }
	): Promise<any> {
		const tenant = await this.getIntegrationTenant(organizationId);
		return this.request<any>('POST', `/scenarios/${scenarioId}/run`, tenant, {
			data: options?.data,
			params: options?.responsive ? { responsive: true } : undefined
		});
	}

	// ─── Hooks (Webhooks) ───────────────────────────────────────────────────

	/**
	 * List hooks for a team.
	 */
	async listHooks(
		teamId?: number,
		organizationId?: string,
		pagination?: IMakeComPaginationParams
	): Promise<IMakeComHook[]> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const resolvedTeamId = teamId ?? await this.getMakeTeamId(tenant);
		const params = { teamId: resolvedTeamId, ...this.buildPaginationParams(pagination) };
		const result = await this.request<{ hooks: IMakeComHook[] }>(
			'GET', '/hooks', tenant, { params }
		);
		return result.hooks;
	}

	/**
	 * Get a single hook by ID.
	 */
	async getHook(hookId: number, organizationId?: string): Promise<IMakeComHook> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ hook: IMakeComHook }>(
			'GET', `/hooks/${hookId}`, tenant
		);
		return result.hook;
	}

	/**
	 * Create a hook (webhook).
	 */
	async createHook(params: IMakeComCreateHookParams, organizationId?: string): Promise<IMakeComHook> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ hook: IMakeComHook }>(
			'POST', '/hooks', tenant, { data: params }
		);
		return result.hook;
	}

	/**
	 * Delete a hook.
	 */
	async deleteHook(hookId: number, organizationId?: string, confirmed = true): Promise<void> {
		const tenant = await this.getIntegrationTenant(organizationId);
		await this.request<void>('DELETE', `/hooks/${hookId}`, tenant, {
			params: { confirmed }
		});
	}

	/**
	 * Update a hook name.
	 */
	async updateHook(hookId: number, name: string, organizationId?: string): Promise<IMakeComHook> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ hook: IMakeComHook }>(
			'PATCH', `/hooks/${hookId}`, tenant, { data: { name } }
		);
		return result.hook;
	}

	/**
	 * Ping a hook (test).
	 */
	async pingHook(hookId: number, organizationId?: string): Promise<any> {
		const tenant = await this.getIntegrationTenant(organizationId);
		return this.request<any>('GET', `/hooks/${hookId}/ping`, tenant);
	}

	/**
	 * Enable a hook.
	 */
	async enableHook(hookId: number, organizationId?: string): Promise<void> {
		const tenant = await this.getIntegrationTenant(organizationId);
		await this.request<void>('POST', `/hooks/${hookId}/enable`, tenant);
	}

	/**
	 * Disable a hook.
	 */
	async disableHook(hookId: number, organizationId?: string): Promise<void> {
		const tenant = await this.getIntegrationTenant(organizationId);
		await this.request<void>('POST', `/hooks/${hookId}/disable`, tenant);
	}

	// ─── Templates ──────────────────────────────────────────────────────────

	/**
	 * List templates.
	 */
	async listTemplates(
		teamId?: number,
		organizationId?: string,
		pagination?: IMakeComPaginationParams
	): Promise<IMakeComTemplate[]> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const params: Record<string, any> = { ...this.buildPaginationParams(pagination) };
		if (teamId) params.teamId = teamId;
		const result = await this.request<{ templates: IMakeComTemplate[] }>(
			'GET', '/templates', tenant, { params }
		);
		return result.templates;
	}

	/**
	 * Get a single template by ID.
	 */
	async getTemplate(templateId: number, organizationId?: string): Promise<IMakeComTemplate> {
		const tenant = await this.getIntegrationTenant(organizationId);
		const result = await this.request<{ template: IMakeComTemplate }>(
			'GET', `/templates/${templateId}`, tenant
		);
		return result.template;
	}

	/**
	 * Get the blueprint of a template.
	 */
	async getTemplateBlueprint(templateId: number, organizationId?: string): Promise<any> {
		const tenant = await this.getIntegrationTenant(organizationId);
		return this.request<any>('GET', `/templates/${templateId}/blueprint`, tenant);
	}
}
