import { BadRequestException, Controller, Delete, HttpCode, HttpStatus, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IOrganizationTeamEmployee, PermissionsEnum } from '@gauzy/contracts';
import { DeleteResult } from 'typeorm';
import { TransformInterceptor } from ',./../core/interceptors';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe } from './../shared/pipes';
import { OrganizationTeamEmployeeService } from './organization-team-employee.service';

@ApiTags('OrganizationTeamEmployee')
@UseInterceptors(TransformInterceptor)
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_TEAM_EDIT)
@Controller()
export class OrganizationTeamEmployeeController {

    constructor(
		private readonly organizationTeamEmployeeService: OrganizationTeamEmployeeService
	) {}

    @ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: IOrganizationTeamEmployee['id']
	): Promise<DeleteResult> {
		try {
			return await this.organizationTeamEmployeeService.delete(id);
		} catch (error) {
			throw new BadRequestException();
		}
    }
}
