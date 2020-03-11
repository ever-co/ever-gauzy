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
import { EmploymentTypes } from './employment-types.entity';
import { EmploymentTypesService } from './employment-types.service';
import { EmploymentTypesCreateInput } from '@gauzy/models';

@ApiTags('EmploymentTypes')
@Controller('empTypes')
export class EmploymentTypesController extends CrudController<EmploymentTypes> {
	constructor(
		private readonly employmentTypesService: EmploymentTypesService
	) {
		super(employmentTypesService);
	}

	@Post('addType')
	@Header('Content-Type', 'application/json')
	createEmpType(@Body() empType: EmploymentTypesCreateInput) {
		return this.employmentTypesService.create(empType);
	}

	@Get('getEmpTypes/:orgId')
	@Header('Content-Type', 'application/json')
	async retrieveAllEmpTypes(@Param() params) {
		return this.employmentTypesService.retrieve(params.orgId);
	}

	@Delete('delType/:id')
	async delType(@Param() params) {
		return this.employmentTypesService.delete(params.id);
	}

	@Patch('updateType/:id')
	async updateType(@Body() empType, @Param() params) {
		return this.employmentTypesService.update(params.id, empType);
	}
}
