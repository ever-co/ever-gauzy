import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	Body,
	Controller,
	Delete,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { DeleteResult, UpdateResult } from 'typeorm';
import { IOrganizationTeamEmployee, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';
import { DeleteTeamMemberQueryDTO, UpdateOrganizationTeamActiveTaskDTO, UpdateTeamMemberDTO } from './dto';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';

@ApiTags('OrganizationTeamEmployee')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class OrganizationTeamEmployeeController {
	constructor(private readonly organizationTeamEmployeeService: OrganizationTeamEmployeeService) { }

	/**
	 * Update team member by memberId
	 *
	 * @param memberId
	 * @param options
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
	@UseValidationPipe({ whitelist: true })
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) memberId: IOrganizationTeamEmployee['id'],
		@Body() entity: UpdateTeamMemberDTO
	): Promise<UpdateResult | IOrganizationTeamEmployee> {
		return await this.organizationTeamEmployeeService.update(memberId, entity);
	}

	/**
	 * Update organization team member active task entity
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT_ACTIVE_TASK)
	@UseValidationPipe({ whitelist: true })
	@Put(':id/active-task')
	async updateActiveTask(
		@Param('id', UUIDValidationPipe) memberId: IOrganizationTeamEmployee['id'],
		@Body() entity: UpdateOrganizationTeamActiveTaskDTO
	): Promise<UpdateResult | IOrganizationTeamEmployee> {
		return await this.organizationTeamEmployeeService.updateActiveTask(memberId, entity);
	}

	/**
	 * Delete team member by memberId
	 *
	 * @param memberId
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete organization team member record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_DELETE)
	@UseValidationPipe({ whitelist: true })
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) memberId: IOrganizationTeamEmployee['id'],
		@Query() options: DeleteTeamMemberQueryDTO
	): Promise<DeleteResult | OrganizationTeamEmployee> {
		return await this.organizationTeamEmployeeService.deleteTeamMember(memberId, options);
	}
}
