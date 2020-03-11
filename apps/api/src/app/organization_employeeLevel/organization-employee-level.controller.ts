import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CrudController } from '../core';
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
	async findByOrgId(@Param() params): Promise<Object> {
		const orgId = params.orgId;
		return await this.employeeLevelService.findAll({
			where: { organizationId: orgId }
		});
	}
}
