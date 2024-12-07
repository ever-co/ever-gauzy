import {
	IEditEntityByMemberInput,
	IOrganizationDepartment,
	IOrganizationDepartmentCreateInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, PaginationParams } from './../core/crud';
import { OrganizationDepartmentEditByEmployeeCommand, OrganizationDepartmentUpdateCommand } from './commands';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentService } from './organization-department.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationDepartment')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationDepartmentController extends CrudController<OrganizationDepartment> {
	constructor(
		private readonly organizationDepartmentService: OrganizationDepartmentService,
		private readonly commandBus: CommandBus
	) {
		super(organizationDepartmentService);
	}

	/**
	 * GET organization department by employee
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization departments.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found departments',
		type: OrganizationDepartment
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('employee/:id')
	async findByEmployee(@Param('id', UUIDValidationPipe) id: string): Promise<IPagination<OrganizationDepartment>> {
		return this.organizationDepartmentService.findByEmployee(id);
	}

	/**
	 * UPDATE organization department by employee
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
		return this.commandBus.execute(new OrganizationDepartmentEditByEmployeeCommand(entity));
	}

	/**
	 * GET all organization department
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization departments.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found departments',
		type: OrganizationDepartment
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationDepartment>> {
		const { findInput, relations, order } = data;
		return this.organizationDepartmentService.findAll({
			where: findInput,
			order,
			relations
		});
	}

	/**
	 * Get pagination data of organization department
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INCOMES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() filter: PaginationParams<OrganizationDepartment>
	): Promise<IPagination<IOrganizationDepartment>> {
		return this.organizationDepartmentService.pagination(filter);
	}

	/**
	 * UPDATE organization department by id
	 *
	 * @param id
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
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IOrganizationDepartmentCreateInput
	): Promise<any> {
		return this.commandBus.execute(new OrganizationDepartmentUpdateCommand(id, entity));
	}
}
