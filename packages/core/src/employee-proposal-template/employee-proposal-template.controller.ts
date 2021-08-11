import { IEmployeeProposalTemplate, IPagination,  } from '@gauzy/contracts';
import {
	Controller,
	Get,
	HttpStatus,
	Param,
	Post,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FindManyOptions } from 'typeorm';
import { UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { CrudController, PaginationParams } from './../core/crud';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';

@ApiTags('EmployeeProposalTemplate')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EmployeeProposalTemplateController extends CrudController<EmployeeProposalTemplate> {
	constructor(
		private readonly employeeProposalTemplateService: EmployeeProposalTemplateService
	) {
		super(employeeProposalTemplateService);
	}

	/**
	 * GET employee proposal template via pagination
	 * 
	 * @param filter 
	 * @returns 
	 */
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<EmployeeProposalTemplate>
	): Promise<IPagination<IEmployeeProposalTemplate>> {
		return this.employeeProposalTemplateService.paginate(filter);
	}

	/**
	 * CREATE make default template by id
	 * 
	 * @param id 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Make Default' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Record Updated'
	})
	@Post(':id/make-default')
	async makeDefault(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<EmployeeProposalTemplate> {
		return await this.employeeProposalTemplateService.makeDefault(
			id
		);
	}

	/**
	 * GET all employee proposal templates
	 * 
	 * @param filter 
	 * @returns 
	 */
	@ApiOperation({ summary: 'find all employee proposal templates' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get()
	async findAll(
		@Query() filter?: FindManyOptions<EmployeeProposalTemplate>
	): Promise<IPagination<IEmployeeProposalTemplate>> {
		return this.employeeProposalTemplateService.findAll(filter);
	}
}
