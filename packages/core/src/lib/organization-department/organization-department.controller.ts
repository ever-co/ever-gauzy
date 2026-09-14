import {
	ID,
	IEditEntityByMemberInput,
	IOrganizationDepartment,
	IOrganizationDepartmentCreateInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
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
	UsePipes
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DeepPartial } from 'typeorm';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { OrganizationDepartmentEditByEmployeeCommand, OrganizationDepartmentUpdateCommand } from './commands';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentService } from './organization-department.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { AbstractValidationPipe, ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { TenantOrganizationBaseDTO } from './../core/dto';

@ApiTags('OrganizationDepartment')
@UseGuards(TenantPermissionGuard)
@Controller('/organization-department')
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
	async findByEmployee(@Param('id', UUIDValidationPipe) id: ID): Promise<IPagination<OrganizationDepartment>> {
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
	async updateByEmployee(@Body() entity: IEditEntityByMemberInput): Promise<void> {
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
		@Query() filter: BaseQueryDTO<OrganizationDepartment>
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: IOrganizationDepartmentCreateInput
	): Promise<IOrganizationDepartment> {
		return this.commandBus.execute(new OrganizationDepartmentUpdateCommand(id, entity));
	}

	/**
	 * CREATE organization department
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach the permission gate:
	 * `PermissionGuard` authorizes any route that carries no `@Permissions` metadata, so an
	 * inherited handler is reachable by every member of the tenant until it is gated here.
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Post()
	async create(@Body() entity: DeepPartial<OrganizationDepartment>): Promise<OrganizationDepartment> {
		return super.create(entity);
	}

	/**
	 * DELETE organization department by id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate.
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE organization department by id
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach the permission gate.
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationDepartment> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted organization department by id
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach the permission gate.
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationDepartment> {
		return super.softRecover(id, ...options);
	}
}
