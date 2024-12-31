import { Body, Controller, Get, HttpStatus, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiResponse, ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { ID, IEmployeeProposalTemplate, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	PaginationParams
} from '@gauzy/core';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';
import { CreateProposalTemplateDTO, UpdateProposalTemplateDTO } from './dto';
import { ProposalTemplateDTO } from './dto/proposal-template.dto';

@ApiTags('EmployeeProposalTemplate')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_PROPOSAL_TEMPLATES_EDIT)
@Controller('/employee-proposal-template')
export class EmployeeProposalTemplateController extends CrudController<EmployeeProposalTemplate> {
	constructor(private readonly employeeProposalTemplateService: EmployeeProposalTemplateService) {
		super(employeeProposalTemplateService);
	}

	/**
	 * GET employee proposal template via pagination.
	 *
	 * Retrieves a paginated list of employee proposal templates from the database.
	 *
	 * @param params Pagination parameters (e.g., `skip`, `take`, filters).
	 * @returns A paginated result containing an array of `IEmployeeProposalTemplate`.
	 */
	@ApiOperation({
		summary: 'Get paginated employee proposal templates',
		description: 'Retrieves a paginated list of employee proposal templates.'
	})
	@ApiQuery({
		name: 'skip',
		type: Number,
		required: false,
		description: 'Number of records to skip.'
	})
	@ApiQuery({
		name: 'take',
		type: Number,
		required: false,
		description: 'Number of records to retrieve.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successful retrieval of paginated results.',
		type: EmployeeProposalTemplate,
		isArray: true
	})
	@Permissions(PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() params: PaginationParams<EmployeeProposalTemplate>
	): Promise<IPagination<IEmployeeProposalTemplate>> {
		return await this.employeeProposalTemplateService.paginate(params);
	}

	/**
	 * CREATE make default template by ID.
	 *
	 * Marks an existing proposal template as the default template by its ID.
	 *
	 * @param id The UUID of the proposal template to set as default.
	 * @param input The DTO containing extra data needed for the operation (if any).
	 * @returns The updated `IEmployeeProposalTemplate`.
	 */
	@ApiOperation({ summary: 'Make Default' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Record updated successfully.'
	})
	@ApiParam({
		name: 'id',
		type: 'string',
		description: 'The UUID of the proposal template to be marked default.'
	})
	@ApiBody({
		type: ProposalTemplateDTO,
		required: false,
		description: 'Optional data to process while making the template default.'
	})
	@Patch('/:id/make-default')
	async makeDefault(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: ProposalTemplateDTO
	): Promise<IEmployeeProposalTemplate> {
		return await this.employeeProposalTemplateService.makeDefault(id, input);
	}

	/**
	 * GET all employee proposal templates.
	 *
	 * Retrieves all employee proposal templates from the database.
	 * Optionally supports pagination parameters or query filters.
	 *
	 * @param params Optional pagination parameters or query filters.
	 * @returns A paginated result containing an array of `IEmployeeProposalTemplate`.
	 */
	@ApiOperation({
		summary: 'Find all employee proposal templates',
		description: 'Retrieves all existing employee proposal templates, optionally paginated.'
	})
	@ApiQuery({
		name: 'skip',
		type: Number,
		required: false,
		description: 'Number of records to skip.'
	})
	@ApiQuery({
		name: 'take',
		type: Number,
		required: false,
		description: 'Number of records to retrieve.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records successfully.',
		type: EmployeeProposalTemplate,
		isArray: true
	})
	@Permissions(PermissionsEnum.ORG_PROPOSAL_TEMPLATES_VIEW)
	@Get('/')
	@UseValidationPipe()
	async findAll(
		@Query() params?: PaginationParams<EmployeeProposalTemplate>
	): Promise<IPagination<IEmployeeProposalTemplate>> {
		return await this.employeeProposalTemplateService.findAll(params);
	}

	/**
	 * CREATE employee proposal template
	 *
	 * Creates a new `EmployeeProposalTemplate` entity in the database.
	 *
	 * @param {CreateProposalTemplateDTO} entity - The DTO containing creation data.
	 * @returns {Promise<IEmployeeProposalTemplate>} The newly created proposal template.
	 */
	@ApiOperation({
		summary: 'Create employee proposal template',
		description: 'Creates a new employee proposal template in the database.'
	})
	@ApiResponse({
		status: 201,
		description: 'The proposal template has been successfully created.',
		type: () => CreateProposalTemplateDTO
	})
	@ApiBody({
		type: CreateProposalTemplateDTO,
		required: true,
		description: 'Payload to create a new proposal template.'
	})
	@Post('/')
	@UseValidationPipe({ whitelist: true, transform: true })
	async create(
		@Body() entity: CreateProposalTemplateDTO
	): Promise<IEmployeeProposalTemplate> {
		return await this.employeeProposalTemplateService.create(entity);
	}

	/**
	 * UPDATE employee proposal template
	 *
	 * Updates an existing `EmployeeProposalTemplate` in the database.
	 *
	 * @param {ID} id - The unique identifier of the proposal template.
	 * @param {UpdateProposalTemplateDTO} entity - The DTO containing updated data.
	 * @returns {Promise<IEmployeeProposalTemplate | UpdateResult>} The updated proposal template or a TypeORM UpdateResult.
	 */
	@ApiOperation({
		summary: 'Update employee proposal template',
		description: 'Updates an existing employee proposal template by ID.'
	})
	@ApiBody({
		type: UpdateProposalTemplateDTO,
		required: true,
		description: 'Payload to update a proposal template.'
	})
	@ApiResponse({
		status: 200,
		description: 'The proposal template has been successfully updated.',
		type: () => UpdateProposalTemplateDTO
	})
	@Put('/:id')
	@UseValidationPipe({ whitelist: true, transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateProposalTemplateDTO
	): Promise<IEmployeeProposalTemplate | UpdateResult> {
		return await this.employeeProposalTemplateService.update(id, entity);
	}
}
