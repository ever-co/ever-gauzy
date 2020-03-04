import { ApiTags } from '@nestjs/swagger';
import {
	Controller,
	Post,
	Header,
	Body,
	Get,
	Param,
	Delete,
	Patch
} from '@nestjs/common';
import { CrudController } from '../core/crud';
import { EmployeeTypes } from './employee-types.entity';
import { EmployeeTypesService } from './employee-types.service';
import { EmployeeTypesCreateInput } from '@gauzy/models';

@ApiTags('EmployeeTypes')
@Controller('empTypes')
export class EmployeeTypesController extends CrudController<EmployeeTypes> {
	constructor(private readonly employeeTypesService: EmployeeTypesService) {
		super(employeeTypesService);
	}

	@Post('addType')
	@Header('Content-Type', 'application/json')
	createEmpType(@Body() empType: EmployeeTypesCreateInput) {
		return this.employeeTypesService.create(empType);
	}

	@Get('getEmpTypes/:orgId')
	@Header('Content-Type', 'application/json')
	async retrieveAllEmpTypes(@Param() params) {
		return this.employeeTypesService.retrieve(params.orgId);
	}

	@Delete('delType/:id')
	async delType(@Param() params) {
		return this.employeeTypesService.delete(params.id);
	}

	@Patch('updateType/:id')
	async updateType(@Body() empType, @Param() params) {
		return this.employeeTypesService.update(params.id, empType);
	}
}
