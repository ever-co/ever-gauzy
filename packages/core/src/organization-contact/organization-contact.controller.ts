import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IEditEntityByMemberInput,
	IOrganizationContact,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { OrganizationContactCreateCommand, OrganizationContactEditByEmployeeCommand } from './commands';
import { OrganizationContact } from './organization-contact.entity';
import { OrganizationContactService } from './organization-contact.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CreateOrganizationContactDTO } from './dto';

@ApiTags('OrganizationContact')
@UseGuards(TenantPermissionGuard)
@Controller()
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
	 * @param filter 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find all organization contact counts in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization contact count'
	})
	@Get('count')
	async getCount(
		@Query() filter: PaginationParams<IOrganizationContact>
	): Promise<number> {
		return await this.organizationContactService.count(filter);
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
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<IOrganizationContact>
	): Promise<IPagination<IOrganizationContact>> {
		return this.organizationContactService.pagination(filter);
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
	@Get('employee/:id')
	async findByEmployee(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IOrganizationContact>> {
		return this.organizationContactService.findByEmployee(id, data);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Put('employee')
	async updateByEmployee(
		@Body() entity: IEditEntityByMemberInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationContactEditByEmployeeCommand(entity)
		);
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IOrganizationContact>> {
		return this.organizationContactService.findAllOrganizationContacts(
			data
		);
	}

	/**
	 * CREATE organization contact
	 * 
	 * @param body 
	 * @returns 
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(
		@Body() body: CreateOrganizationContactDTO
	): Promise<IOrganizationContact> {
		return this.commandBus.execute(
			new OrganizationContactCreateCommand(body)
		);
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
		const {relations = []} = data;
		return this.organizationContactService.findById(
			id,
			relations
		);
	}
}
