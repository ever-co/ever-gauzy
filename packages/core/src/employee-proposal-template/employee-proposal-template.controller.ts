import { IPagination } from '@gauzy/contracts';
import {
	Controller,
	Get,
	HttpStatus,
	Param,
	Post,
	Query
} from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FindManyOptions } from 'typeorm';
import { CrudController } from '../core';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';

@Controller('employee-proposal-template')
export class EmployeeProposalTemplateController extends CrudController<EmployeeProposalTemplate> {
	constructor(
		private readonly employeeProposalTemplateService: EmployeeProposalTemplateService
	) {
		super(employeeProposalTemplateService);
	}

	@ApiOperation({ summary: 'find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get()
	async getAll(
		@Query() filter?: FindManyOptions<EmployeeProposalTemplate>
	): Promise<IPagination<EmployeeProposalTemplate>> {
		return this.employeeProposalTemplateService.findAll(filter);
	}

	@ApiOperation({ summary: 'Make Default' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Record Updated'
	})
	@Post(':id/make-default')
	async makeDefault(
		@Param('id') employeeProposalTemplate?: string
	): Promise<EmployeeProposalTemplate> {
		return this.employeeProposalTemplateService.makeDefault(
			employeeProposalTemplate
		);
	}
}
