import { Controller, Get } from '@nestjs/common';
import { CrudController } from '../core';
import { EmployeeLevel } from './organization-employee-level.entity';
import { EmployeeLevelService } from './organization-employee-level.service';

@Controller()
export class EmployeeLevelController extends CrudController<EmployeeLevel> {
	constructor(private employeeLevelService: EmployeeLevelService) {
		super(employeeLevelService);
	}

	@Get()
	findAll() {
		console.log('here');
		return this.employeeLevelService.findAll();
	}
}
