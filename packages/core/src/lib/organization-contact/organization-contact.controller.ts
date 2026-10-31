import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes,
	UseInterceptors
} from '@nestjs/common';
import { FormerEmployeesInterceptor } from '../employee/former-employees.interceptor';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	ID,
	IEditEntityByMemberInput,
	IEmployee,
	IOrganizationContact,
	IPagination,
	ORGANIZATION_CONTACT_CREATE_PERMISSIONS,
	ORGANIZATION_CONTACT_DELETE_PERMISSIONS,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { TenantOrganizationBaseDTO } from './../core/dto';
import {
	OrganizationContactCreateCommand,
	OrganizationContactEditByEmployeeCommand,
	OrganizationContactUpdateCommand
} from './commands';
import { OrganizationContact } from './organization-contact.entity';
import { OrganizationContactService } from './organization-contact.service';
import { organizationContactCreateOptions } from './organization-contact.permissions';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { CountQueryDTO } from './../shared/dto';
import { AbstractValidationPipe, ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateOrganizationContactDTO, UpdateOrganizationContactDTO } from './dto';

@ApiTags('OrganizationContact')
@UseGuards(TenantPermissionGuard)
@UseInterceptors(FormerEmployeesInterceptor)
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
	@Get('/count')
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
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() filter: BaseQueryDTO<OrganizationContact>): Promise<IPagination<IOrganizationContact>> {
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
	@Get('/employee/:employeeId')
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
	@Put('/employee')
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
	@Get('/')
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
	@Get('/:id')
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
	 * `ORG_CONTACT_ADD` or `ORG_CONTACT_EDIT`. A caller without `ORG_CONTACT_EDIT` creates only: the body cannot
	 * name or reach a record that already exists (see `toCreateOnlyContactInput`).
	 *
	 * @param entity
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(...ORGANIZATION_CONTACT_CREATE_PERMISSIONS)
	@Post('/')
	@UseValidationPipe()
	async create(@Body() entity: CreateOrganizationContactDTO): Promise<IOrganizationContact> {
		return await this.commandBus.execute(
			new OrganizationContactCreateCommand(entity, organizationContactCreateOptions())
		);
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
	@Put('/:id')
	@UseValidationPipe()
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrganizationContactDTO
	): Promise<IOrganizationContact> {
		return await this.commandBus.execute(new OrganizationContactUpdateCommand(id, entity));
	}

	/**
	 * DELETE organization contact by id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate
	 * (GHSA-v79w-54p2-wmh5): `ORG_CONTACT_DELETE`, or `ORG_CONTACT_EDIT`, which has always allowed it.
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The record has been successfully deleted'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(...ORGANIZATION_CONTACT_DELETE_PERMISSIONS)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE organization contact by id
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach the permission gate
	 * (GHSA-v79w-54p2-wmh5): the same as the delete, `ORG_CONTACT_DELETE` or `ORG_CONTACT_EDIT`.
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record soft deleted successfully'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(...ORGANIZATION_CONTACT_DELETE_PERMISSIONS)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationContact> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted organization contact by id
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach the permission gate
	 * (GHSA-v79w-54p2-wmh5): `ORG_CONTACT_EDIT`, the permission that edits a contact.
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record restored successfully'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationContact> {
		return super.softRecover(id, ...options);
	}
}
