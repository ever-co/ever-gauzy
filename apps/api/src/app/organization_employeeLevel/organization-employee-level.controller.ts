import {
	Controller,
	Get,
	Body,
	Param,
	Post,
	Delete,
	Put
} from '@nestjs/common';
import { CrudController } from '../core';
import { EmployeeLevel } from './organization-employee-level.entity';
import { EmployeeLevelService } from './organization-employee-level.service';
import { EmployeeLevelInput } from '@gauzy/models';

@Controller()
export class EmployeeLevelController extends CrudController<EmployeeLevel> {
	constructor(private employeeLevelService: EmployeeLevelService) {
		super(employeeLevelService);
	}

	@Get(':orgId')
	async findByOrgId(@Param() params): Promise<Object> {
		const orgId = params.orgId;
		return await this.employeeLevelService.findAll({
			where: { organizationId: orgId }
		});
	}

	@Post()
	async createEmployeeLevel(@Body() employeeLevel: EmployeeLevelInput) {
		return await this.employeeLevelService.create(employeeLevel);
	}

	@Delete(':id')
	async deleteEmployeeLevel(@Param() params) {
		const id = params.id;
		return await this.employeeLevelService.delete(id);
	}

	@Put(':id')
	async updateEmployeeLevel(
		@Param() params,
		@Body() employeeLevel: EmployeeLevelInput
	) {
		const id = params.id;
		return await this.employeeLevelService.update(id, employeeLevel);
	}
}
