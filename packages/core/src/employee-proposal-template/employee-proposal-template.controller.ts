import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { IEmployeeProposalTemplate, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { CrudController, PaginationParams } from './../core/crud';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';
import { CreateProposalTemplateDTO, UpdateProposalTemplateDTO } from './dto';

@ApiTags('EmployeeProposalTemplate')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT)
@Controller()
export class EmployeeProposalTemplateController extends CrudController<EmployeeProposalTemplate> {
	constructor(private readonly employeeProposalTemplateService: EmployeeProposalTemplateService) {
		super(employeeProposalTemplateService);
	}

	/**
	 * GET employee proposal template via pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() params: PaginationParams<EmployeeProposalTemplate>
	): Promise<IPagination<IEmployeeProposalTemplate>> {
		return await this.employeeProposalTemplateService.paginate(params);
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
	async makeDefault(@Param('id', UUIDValidationPipe) id: string): Promise<IEmployeeProposalTemplate> {
		return await this.employeeProposalTemplateService.makeDefault(id);
	}

	/**
	 * GET all employee proposal templates
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'find all employee proposal templates' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Permissions(PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(
		@Query() params?: PaginationParams<EmployeeProposalTemplate>
	): Promise<IPagination<IEmployeeProposalTemplate>> {
		try {
			return await this.employeeProposalTemplateService.findAll(params);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * CREATE employee proposal template
	 *
	 * @param entity
	 * @returns
	 */
	@Post()
	@UseValidationPipe({ whitelist: true, transform: true })
	async create(@Body() entity: CreateProposalTemplateDTO): Promise<IEmployeeProposalTemplate> {
		return await this.employeeProposalTemplateService.create(entity);
	}

	/**
	 * UPDATE employee proposal template
	 *
	 * @param entity
	 * @returns
	 */
	@Put(':id')
	@UseValidationPipe({ whitelist: true, transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateProposalTemplateDTO
	): Promise<IEmployeeProposalTemplate | UpdateResult> {
		return await this.employeeProposalTemplateService.update(id, entity);
	}
}
