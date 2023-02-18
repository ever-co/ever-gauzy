import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Put, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { DeleteResult, UpdateResult } from 'typeorm';
import { IOrganizationTeamEmployee, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe } from './../shared/pipes';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';
import { DeleteTeamMemberQueryDTO, UpdateTeamMemberDTO } from './dto';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';

@ApiTags('OrganizationTeamEmployee')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class OrganizationTeamEmployeeController {

	constructor(
		private readonly organizationTeamEmployeeService: OrganizationTeamEmployeeService
	) { }

	/**
	 * Update team member by memberId
	 *
	 * @param memberId
	 * @param options
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
	@UsePipes(new ValidationPipe({ whitelist: true }))
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) memberId: IOrganizationTeamEmployee['id'],
		@Body() entity: UpdateTeamMemberDTO
	): Promise<UpdateResult | IOrganizationTeamEmployee> {
		return await this.organizationTeamEmployeeService.update(memberId, entity);
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
	@UsePipes(new ValidationPipe({ whitelist: true }))
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) memberId: IOrganizationTeamEmployee['id'],
		@Query() options: DeleteTeamMemberQueryDTO
	): Promise<DeleteResult | OrganizationTeamEmployee> {
		return await this.organizationTeamEmployeeService.deleteTeamMember(memberId, options);
	}
}
