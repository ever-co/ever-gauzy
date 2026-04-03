import {
	Controller,
	Get,
	Post,
	Patch,
	Delete,
	Body,
	Param,
	Query,
	UseGuards,
	ParseIntPipe,
	HttpCode,
	HttpStatus,
	BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TenantPermissionGuard, PermissionGuard, Permissions } from '@gauzy/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { MakeComApiService } from './make-com-api.service';
import { IMakeComPaginationParams, MAKE_COM_ZONES, MakeComZone } from './interfaces/make-com-api.model';

@ApiTags('Make.com API')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/make-com/api')
export class MakeComApiController {
	constructor(private readonly makeComApiService: MakeComApiService) {}

	// ─── Helpers ────────────────────────────────────────────────────────────

	private extractPagination(query: Record<string, any>): IMakeComPaginationParams {
		const pagination: IMakeComPaginationParams = {};
		if (query.offset != null) {
			const offset = parseInt(query.offset, 10);
			if (!isNaN(offset)) pagination['pg[offset]'] = offset;
		}
		if (query.limit != null) {
			const limit = parseInt(query.limit, 10);
			if (!isNaN(limit)) pagination['pg[limit]'] = limit;
		}
		if (query.sortBy) pagination['pg[sortBy]'] = query.sortBy;
		if (query.sortDir) pagination['pg[sortDir]'] = query.sortDir;
		return pagination;
	}

	// ─── Setup Status ───────────────────────────────────────────────────────

	@ApiOperation({ summary: 'Get Make.com setup status (zone, org, team, token)' })
	@Get('/setup-status')
	async getSetupStatus(@Query('organizationId') organizationId?: string) {
		return this.makeComApiService.getSetupStatus(organizationId);
	}

	// ─── Zone Configuration ─────────────────────────────────────────────────

	@ApiOperation({ summary: 'Get available Make.com zones' })
	@Get('/zones')
	getAvailableZones() {
		return { zones: MAKE_COM_ZONES };
	}

	@ApiOperation({ summary: 'Get the configured zone for this tenant' })
	@Get('/zone')
	async getZone(@Query('organizationId') organizationId?: string) {
		const zone = await this.makeComApiService.getZone(organizationId);
		return { zone };
	}

	@ApiOperation({ summary: 'Set the Make.com zone for this tenant' })
	@Post('/zone')
	async setZone(@Body() body: { zone: MakeComZone; organizationId?: string }) {
		await this.makeComApiService.setZone(body.zone, body.organizationId);
		return { success: true, zone: body.zone };
	}

	// ─── Context (Make.com org/team selection) ──────────────────────────────

	@ApiOperation({ summary: 'Set the Make.com organization ID for this tenant' })
	@Post('/context/organization')
	async setMakeOrganization(@Body() body: { makeOrganizationId: number; organizationId?: string }) {
		if (!body.makeOrganizationId || isNaN(Number(body.makeOrganizationId))) {
			throw new BadRequestException('A valid makeOrganizationId is required');
		}
		await this.makeComApiService.setMakeOrganizationId(body.makeOrganizationId, body.organizationId);
		return { success: true, makeOrganizationId: body.makeOrganizationId };
	}

	@ApiOperation({ summary: 'Set the Make.com team ID for this tenant' })
	@Post('/context/team')
	async setMakeTeam(@Body() body: { makeTeamId: number; organizationId?: string }) {
		if (!body.makeTeamId || isNaN(Number(body.makeTeamId))) {
			throw new BadRequestException('A valid makeTeamId is required');
		}
		await this.makeComApiService.setMakeTeamId(body.makeTeamId, body.organizationId);
		return { success: true, makeTeamId: body.makeTeamId };
	}

	// ─── Organizations ──────────────────────────────────────────────────────

	@ApiOperation({ summary: 'List Make.com organizations for the authenticated user' })
	@Get('/organizations')
	async listOrganizations(@Query('organizationId') organizationId?: string) {
		const organizations = await this.makeComApiService.listOrganizations(organizationId);
		return { organizations };
	}

	@ApiOperation({ summary: 'Get a Make.com organization by ID' })
	@Get('/organizations/:id')
	async getOrganization(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		const organization = await this.makeComApiService.getOrganization(id, organizationId);
		return { organization };
	}

	// ─── Teams ──────────────────────────────────────────────────────────────

	@ApiOperation({ summary: 'List Make.com teams' })
	@ApiQuery({ name: 'makeOrgId', required: false, type: Number })
	@Get('/teams')
	async listTeams(
		@Query('makeOrgId') makeOrgId?: string,
		@Query('organizationId') organizationId?: string,
		@Query() query?: Record<string, any>
	) {
		const parsedOrgId = makeOrgId ? parseInt(makeOrgId, 10) : undefined;
		const teams = await this.makeComApiService.listTeams(
			parsedOrgId && !isNaN(parsedOrgId) ? parsedOrgId : undefined,
			organizationId,
			this.extractPagination(query)
		);
		return { teams };
	}

	@ApiOperation({ summary: 'Get a Make.com team by ID' })
	@Get('/teams/:id')
	async getTeam(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		const team = await this.makeComApiService.getTeam(id, organizationId);
		return { team };
	}

	// ─── Connections ────────────────────────────────────────────────────────

	@ApiOperation({ summary: 'List Make.com connections' })
	@ApiQuery({ name: 'teamId', required: false, type: Number })
	@Get('/connections')
	async listConnections(
		@Query('teamId') teamId?: string,
		@Query('organizationId') organizationId?: string,
		@Query() query?: Record<string, any>
	) {
		const connections = await this.makeComApiService.listConnections(
			teamId ? parseInt(teamId, 10) : undefined,
			organizationId,
			this.extractPagination(query)
		);
		return { connections };
	}

	@ApiOperation({ summary: 'Get a Make.com connection by ID' })
	@Get('/connections/:id')
	async getConnection(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		const connection = await this.makeComApiService.getConnection(id, organizationId);
		return { connection };
	}

	@ApiOperation({ summary: 'Delete a Make.com connection' })
	@Delete('/connections/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteConnection(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		await this.makeComApiService.deleteConnection(id, organizationId);
	}

	@ApiOperation({ summary: 'Test a Make.com connection' })
	@Post('/connections/:id/test')
	async testConnection(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		return this.makeComApiService.testConnection(id, organizationId);
	}

	// ─── Scenarios ──────────────────────────────────────────────────────────

	@ApiOperation({ summary: 'List Make.com scenarios' })
	@ApiQuery({ name: 'teamId', required: false, type: Number })
	@Get('/scenarios')
	async listScenarios(
		@Query('teamId') teamId?: string,
		@Query('organizationId') organizationId?: string,
		@Query() query?: Record<string, any>
	) {
		const scenarios = await this.makeComApiService.listScenarios(
			teamId ? parseInt(teamId, 10) : undefined,
			organizationId,
			this.extractPagination(query)
		);
		return { scenarios };
	}

	@ApiOperation({ summary: 'Get a Make.com scenario by ID' })
	@Get('/scenarios/:id')
	async getScenario(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		const scenario = await this.makeComApiService.getScenario(id, organizationId);
		return { scenario };
	}

	@ApiOperation({ summary: 'Create a Make.com scenario' })
	@Post('/scenarios')
	async createScenario(
		@Body() body: { teamId: number; name: string; blueprint: string; scheduling: any; folderId?: number },
		@Query('organizationId') organizationId?: string
	) {
		const scenario = await this.makeComApiService.createScenario(body, organizationId);
		return { scenario };
	}

	@ApiOperation({ summary: 'Update a Make.com scenario' })
	@Patch('/scenarios/:id')
	async updateScenario(
		@Param('id', ParseIntPipe) id: number,
		@Body() body: { name?: string; blueprint?: string; scheduling?: any },
		@Query('organizationId') organizationId?: string
	) {
		const scenario = await this.makeComApiService.updateScenario(id, body, organizationId);
		return { scenario };
	}

	@ApiOperation({ summary: 'Delete a Make.com scenario' })
	@Delete('/scenarios/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteScenario(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		await this.makeComApiService.deleteScenario(id, organizationId);
	}

	@ApiOperation({ summary: 'Activate a Make.com scenario' })
	@Post('/scenarios/:id/start')
	async startScenario(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		const scenario = await this.makeComApiService.startScenario(id, organizationId);
		return { scenario };
	}

	@ApiOperation({ summary: 'Deactivate a Make.com scenario' })
	@Post('/scenarios/:id/stop')
	async stopScenario(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		const scenario = await this.makeComApiService.stopScenario(id, organizationId);
		return { scenario };
	}

	@ApiOperation({ summary: 'Run a Make.com scenario on demand' })
	@Post('/scenarios/:id/run')
	async runScenario(
		@Param('id', ParseIntPipe) id: number,
		@Body() body?: { responsive?: boolean; data?: any },
		@Query('organizationId') organizationId?: string
	) {
		return this.makeComApiService.runScenario(id, organizationId, body);
	}

	// ─── Hooks (Webhooks) ───────────────────────────────────────────────────

	@ApiOperation({ summary: 'List Make.com hooks (webhooks)' })
	@ApiQuery({ name: 'teamId', required: false, type: Number })
	@Get('/hooks')
	async listHooks(
		@Query('teamId') teamId?: string,
		@Query('organizationId') organizationId?: string,
		@Query() query?: Record<string, any>
	) {
		const hooks = await this.makeComApiService.listHooks(
			teamId ? parseInt(teamId, 10) : undefined,
			organizationId,
			this.extractPagination(query)
		);
		return { hooks };
	}

	@ApiOperation({ summary: 'Get a Make.com hook by ID' })
	@Get('/hooks/:id')
	async getHook(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		const hook = await this.makeComApiService.getHook(id, organizationId);
		return { hook };
	}

	@ApiOperation({ summary: 'Create a Make.com hook (webhook)' })
	@Post('/hooks')
	async createHook(
		@Body() body: { teamId: number; name: string; typeName: string; [key: string]: any },
		@Query('organizationId') organizationId?: string
	) {
		const hook = await this.makeComApiService.createHook(body, organizationId);
		return { hook };
	}

	@ApiOperation({ summary: 'Update a Make.com hook name' })
	@Patch('/hooks/:id')
	async updateHook(
		@Param('id', ParseIntPipe) id: number,
		@Body() body: { name: string },
		@Query('organizationId') organizationId?: string
	) {
		const hook = await this.makeComApiService.updateHook(id, body.name, organizationId);
		return { hook };
	}

	@ApiOperation({ summary: 'Delete a Make.com hook' })
	@Delete('/hooks/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async deleteHook(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		await this.makeComApiService.deleteHook(id, organizationId);
	}

	@ApiOperation({ summary: 'Ping a Make.com hook' })
	@Get('/hooks/:id/ping')
	async pingHook(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		return this.makeComApiService.pingHook(id, organizationId);
	}

	@ApiOperation({ summary: 'Enable a Make.com hook' })
	@Post('/hooks/:id/enable')
	async enableHook(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		await this.makeComApiService.enableHook(id, organizationId);
		return { success: true };
	}

	@ApiOperation({ summary: 'Disable a Make.com hook' })
	@Post('/hooks/:id/disable')
	async disableHook(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		await this.makeComApiService.disableHook(id, organizationId);
		return { success: true };
	}

	// ─── Templates ──────────────────────────────────────────────────────────

	@ApiOperation({ summary: 'List Make.com templates' })
	@ApiQuery({ name: 'teamId', required: false, type: Number })
	@Get('/templates')
	async listTemplates(
		@Query('teamId') teamId?: string,
		@Query('organizationId') organizationId?: string,
		@Query() query?: Record<string, any>
	) {
		const templates = await this.makeComApiService.listTemplates(
			teamId ? parseInt(teamId, 10) : undefined,
			organizationId,
			this.extractPagination(query)
		);
		return { templates };
	}

	@ApiOperation({ summary: 'Get a Make.com template by ID' })
	@Get('/templates/:id')
	async getTemplate(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		const template = await this.makeComApiService.getTemplate(id, organizationId);
		return { template };
	}

	@ApiOperation({ summary: 'Get the blueprint of a Make.com template' })
	@Get('/templates/:id/blueprint')
	async getTemplateBlueprint(
		@Param('id', ParseIntPipe) id: number,
		@Query('organizationId') organizationId?: string
	) {
		return this.makeComApiService.getTemplateBlueprint(id, organizationId);
	}
}
