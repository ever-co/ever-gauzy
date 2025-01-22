import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IEditEntityByMemberInput,
	IEmployee,
	IOrganizationContact,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { TenantOrganizationBaseDTO } from './../core/dto';
import {
	OrganizationContactCreateCommand,
	OrganizationContactEditByEmployeeCommand,
	OrganizationContactUpdateCommand
} from './commands';
import { OrganizationContact } from './organization-contact.entity';
import { OrganizationContactService } from './organization-contact.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { CountQueryDTO } from './../shared/dto';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateOrganizationContactDTO, UpdateOrganizationContactDTO } from './dto';

@ApiTags('OrganizationContact')
@UseGuards(TenantPermissionGuard)
@Controller('/organization-contact')
export class OrganizationContactController extends CrudController<OrganizationContact> {
	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly commandBus: CommandBus
	) {
		super(organizationContactService);
	}

	/**
	 * GET organization contact count
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all organization contact counts in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization contact count'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	@Get('count')
	async getCount(@Query() options: CountQueryDTO<OrganizationContact>): Promise<number> {
		return await this.organizationContactService.countBy(options);
	}

	/**
	 * GET all organization contact by Pagination
	 *
	 * @param filter
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all organization contacts in the same tenant using pagination.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization contacts in the tenant',
		type: OrganizationContact
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() filter: PaginationParams<OrganizationContact>
	): Promise<IPagination<IOrganizationContact>> {
		return await this.organizationContactService.pagination(filter);
	}

	/**
	 * GET all organization contacts by Employee
	 *
	 * @param id
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization contacts by Employee.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization contacts',
		type: OrganizationContact
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('employee/:employeeId')
	async findByEmployee(
		@Param('employeeId', UUIDValidationPipe) employeeId: IEmployee['id'],
		@Query() options: TenantOrganizationBaseDTO
	): Promise<IOrganizationContact[]> {
		return await this.organizationContactService.findByEmployee(employeeId, options);
	}

	/**
	 * UPDATE organization contact by Employee
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Put('employee')
	async updateByEmployee(@Body() entity: IEditEntityByMemberInput): Promise<any> {
		return this.commandBus.execute(new OrganizationContactEditByEmployeeCommand(entity));
	}

	/**
	 * GET all organization contacts
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization contacts.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found contacts recurring expense',
		type: OrganizationContact
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationContact>> {
		return this.organizationContactService.findAllOrganizationContacts(data);
	}

	/**
	 * GET organization contacts by id
	 *
	 * @param id
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Get organization contacts by id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization contacts.',
		type: OrganizationContact
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IOrganizationContact> {
		const { relations = [] } = data;
		return this.organizationContactService.findById(id, relations);
	}

	/**
	 * CREATE organization contact
	 *
	 * @param entity
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreateOrganizationContactDTO): Promise<IOrganizationContact> {
		return await this.commandBus.execute(new OrganizationContactCreateCommand(entity));
	}

	/**
	 * Update organization contact by ID
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@Put(':id')
	@UseValidationPipe()
	async update(
		@Param('id', UUIDValidationPipe) id: IOrganizationContact['id'],
		@Body() entity: UpdateOrganizationContactDTO
	): Promise<IOrganizationContact> {
		return await this.commandBus.execute(new OrganizationContactUpdateCommand(id, entity));
	}
}
