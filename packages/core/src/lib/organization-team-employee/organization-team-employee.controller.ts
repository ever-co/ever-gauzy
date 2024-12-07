import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Put, Query, UseGuards } from '@nestjs/common';
import { DeleteResult, UpdateResult } from 'typeorm';
import { ID, IOrganizationTeamEmployee, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';
import { DeleteTeamMemberQueryDTO, UpdateOrganizationTeamActiveTaskDTO, UpdateTeamMemberDTO } from './dto';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';

@ApiTags('OrganizationTeamEmployee')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
@Controller('/organization-team-employee')
export class OrganizationTeamEmployeeController {
	constructor(private readonly organizationTeamEmployeeService: OrganizationTeamEmployeeService) {}

	/**
	 * Update a team member by memberId
	 *
	 * @param id - ID of the team member to update
	 * @param entity - Data transfer object for updating team member
	 * @returns Updated team member
	 */
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
	@UseValidationPipe({ whitelist: true })
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateTeamMemberDTO
	): Promise<UpdateResult | IOrganizationTeamEmployee> {
		return this.organizationTeamEmployeeService.update(id, entity);
	}

	/**
	 * Update organization team member's active task entity
	 *
	 * @param id - ID of the team member
	 * @param entity - Data transfer object for updating active task
	 * @returns Updated team member
	 */
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT_ACTIVE_TASK)
	@UseValidationPipe({ whitelist: true })
	@Put('/:id/active-task')
	async updateActiveTask(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrganizationTeamActiveTaskDTO
	): Promise<UpdateResult | IOrganizationTeamEmployee> {
		return this.organizationTeamEmployeeService.updateActiveTask(id, entity);
	}

	/**
	 * Delete a team member by memberId
	 *
	 * @param id - ID of the team member to delete
	 * @param options - Query parameters for deletion
	 * @returns Result of the deletion operation
	 */
	@ApiOperation({ summary: 'Delete an organization team member record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_DELETE)
	@UseValidationPipe({ whitelist: true })
	@Delete('/:id')
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: DeleteTeamMemberQueryDTO
	): Promise<DeleteResult | OrganizationTeamEmployee> {
		return this.organizationTeamEmployeeService.deleteTeamMember(id, options);
	}
}
