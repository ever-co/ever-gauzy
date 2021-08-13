import {
	Controller,
	Get,
	Param,
	UseGuards,
	Query,
	Body,
	Put
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { EmployeeLevel } from './organization-employee-level.entity';
import { EmployeeLevelService } from './organization-employee-level.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationEmployeeLevel')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EmployeeLevelController extends CrudController<EmployeeLevel> {
	constructor(private employeeLevelService: EmployeeLevelService) {
		super(employeeLevelService);
	}

	@Get(':orgId')
	async findByOrgId(
		@Query('data', ParseJsonPipe) data: any,
		@Param('orgId', UUIDValidationPipe) organizationId: string
	): Promise<IPagination<EmployeeLevel>> {
		const { relations, findInput } = data;
		return await this.employeeLevelService.findAll({
			where: {
				organizationId,
				...findInput
			},
			relations
		});
	}

	@Put(':id')
	async updateOrganizationTeam(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: EmployeeLevel,
		...options: any[]
	): Promise<EmployeeLevel> {
		return this.employeeLevelService.create({
			id,
			...entity
		});
	}
}
