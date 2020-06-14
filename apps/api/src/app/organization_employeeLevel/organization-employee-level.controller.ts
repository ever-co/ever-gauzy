import {
	Controller,
	Get,
	Param,
	UseGuards,
	Query,
	Body,
	Put
} from '@nestjs/common';
import { CrudController, IPagination } from '../core';
import { EmployeeLevel } from './organization-employee-level.entity';
import { EmployeeLevelService } from './organization-employee-level.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller()
export class EmployeeLevelController extends CrudController<EmployeeLevel> {
	constructor(private employeeLevelService: EmployeeLevelService) {
		super(employeeLevelService);
	}

	@Get(':orgId')
	async findByOrgId(
		@Query() data,
		@Param() id
	): Promise<IPagination<EmployeeLevel>> {
		const orgId = id.orgId;
		const relations = [];
		relations.push(data.relations);
		return await this.employeeLevelService.findAll({
			where: { organizationId: orgId },
			relations
		});
	}

	@Put(':id')
	async updateOrganizationTeam(
		@Param('id') id: string,
		@Body() entity: EmployeeLevel,
		...options: any[]
	): Promise<EmployeeLevel> {
		return this.employeeLevelService.create({
			id,
			...entity
		});
	}
}
