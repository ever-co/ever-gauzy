import { Body, Controller, Get, Param, Put, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IActivepiecesConnectionsListResponse,
	IActivepiecesListResponse,
	IActivepiecesMcpServer,
	IActivepiecesMcpServersListResponsePublic,
	IActivepiecesPlatformStatus,
	IActivepiecesProject,
	PermissionsEnum
} from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { ActivepiecesOperatorGuard } from './activepieces-operator.guard';
import { ActivepiecesPlatformService, IActivepiecesTenantProjectLink } from './activepieces-platform.service';
import {
	ActivepiecesPlatformProjectQueryDto,
	LinkActivepiecesTenantProjectDto,
	ListActivepiecesPlatformProjectsQueryDto
} from './dto';

/**
 * The platform-wide ("global") Activepieces integration, for the operator of the installation only.
 *
 * These routes act under the installation's platform key without a tenant's project pinned: the platform's projects,
 * any project's connections and MCP servers, and giving a tenant its project. `ActivepiecesOperatorGuard` lets through
 * only a super admin listed in `EVER_OPERATOR_USER_IDS`; the tenant guards and the `@Permissions` below still apply,
 * as on every Activepieces route. A tenant's own requests never come here: they run under the tenant's own key, its
 * project token, or the platform key pinned to its own project (`ActivepiecesCredentialsService`).
 */
@ApiTags('ActivePieces Platform Integration (operator)')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard, ActivepiecesOperatorGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('/integration/activepieces/platform')
export class ActivepiecesPlatformController {
	constructor(private readonly platformService: ActivepiecesPlatformService) {}

	/**
	 * What the operator configured for Activepieces. Never a key.
	 */
	@ApiOperation({ summary: 'Activepieces settings of the installation (operator only)' })
	@ApiResponse({ status: 200, description: 'Which Activepieces credentials the installation has' })
	@Get('/status')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	status(): IActivepiecesPlatformStatus {
		return this.platformService.status();
	}

	/**
	 * The projects of the platform.
	 */
	@ApiOperation({ summary: 'List the projects of the Activepieces platform (operator only)' })
	@ApiResponse({ status: 200, description: 'The projects of the platform' })
	@Get('/projects')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async listProjects(
		@Query() query: ListActivepiecesPlatformProjectsQueryDto
	): Promise<IActivepiecesListResponse<IActivepiecesProject>> {
		return this.platformService.listProjects(query);
	}

	/**
	 * Gives a tenant its Activepieces project: an existing one when named, otherwise found by the tenant's external id
	 * or created.
	 */
	@ApiOperation({ summary: "Provision or link a tenant's Activepieces project (operator only)" })
	@ApiParam({ name: 'tenantId', description: 'Tenant UUID' })
	@ApiResponse({ status: 200, description: "The tenant's project" })
	@ApiResponse({ status: 409, description: 'The project, or the external id, already belongs elsewhere' })
	@Put('/tenants/:tenantId/project')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	async connectTenantProject(
		@Param('tenantId', UUIDValidationPipe) tenantId: string,
		@Body() input: LinkActivepiecesTenantProjectDto
	): Promise<IActivepiecesTenantProjectLink> {
		return this.platformService.connectTenantProject(tenantId, input);
	}

	/**
	 * The connections of any project of the platform.
	 */
	@ApiOperation({ summary: 'List the connections of a project of the platform (operator only)' })
	@ApiResponse({ status: 200, description: 'The connections of the project' })
	@Get('/connections')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async listConnections(
		@Query() query: ActivepiecesPlatformProjectQueryDto
	): Promise<IActivepiecesConnectionsListResponse> {
		return this.platformService.listConnections(query);
	}

	/**
	 * The MCP servers of any project of the platform, without their tokens.
	 */
	@ApiOperation({ summary: 'List the MCP servers of a project of the platform (operator only)' })
	@ApiResponse({ status: 200, description: 'The MCP servers of the project (tokens are not returned)' })
	@Get('/mcp')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async listMcpServers(
		@Query() query: ActivepiecesPlatformProjectQueryDto
	): Promise<IActivepiecesMcpServersListResponsePublic> {
		const result = await this.platformService.listMcpServers(query);
		return {
			data: (result?.data ?? []).map(({ token, ...server }: IActivepiecesMcpServer) => server),
			next: result?.next ?? null,
			previous: result?.previous ?? null
		};
	}
}
