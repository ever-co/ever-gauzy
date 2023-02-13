import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Delete, HttpCode, HttpStatus, Param, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import { IOrganizationTeamEmployee, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe } from './../shared/pipes';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';
import { DeleteTeamMemberQueryDTO } from './dto';
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_DELETE, PermissionsEnum.ORG_TEAM_ADD)
	@UsePipes(new ValidationPipe({ whitelist: true }))
	@Delete(':id')
	async deleteTeamMember(
		@Param('id', UUIDValidationPipe) memberId: IOrganizationTeamEmployee['id'],
		@Query() options: DeleteTeamMemberQueryDTO
	): Promise<DeleteResult | OrganizationTeamEmployee> {
		return await this.organizationTeamEmployeeService.deleteTeamMember(memberId, options);
	}
}
