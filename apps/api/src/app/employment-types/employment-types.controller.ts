import { ApiTags } from '@nestjs/swagger';
import {
	Controller,
	Post,
	Header,
	Body,
	Get,
	Param,
	Delete
} from '@nestjs/common';
import { CrudController } from '../core/crud';
import { EmploymentTypes } from './employment-types.entity';
import { EmploymentTypesService } from './employment-types.service';
import { EmploymentTypesCreateInput } from '@gauzy/models';

@ApiTags('EmploymentTypes')
@Controller('employmentTypes')
export class EmploymentTypesController extends CrudController<EmploymentTypes> {
	constructor(
		private readonly employmentTypesService: EmploymentTypesService
	) {
		super(employmentTypesService);
	}

	@Post('add')
	@Header('Content-Type', 'application/json')
	createEmploymentType(@Body() employmentType: EmploymentTypesCreateInput) {
		return this.employmentTypesService.create(employmentType);
	}

	@Get('getEmploymentTypes/:orgId')
	@Header('Content-Type', 'application/json')
	async retrieveAllEmploymentTypes(@Param() params) {
		return this.employmentTypesService.retrieve(params.orgId);
	}

	@Delete('deleteEmploymentType/:id')
	async deleteEmploymentType(@Param() params) {
		return this.employmentTypesService.delete(params.id);
	}
}
