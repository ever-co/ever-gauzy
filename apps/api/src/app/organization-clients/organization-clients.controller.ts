import { EditEntityByMemberInput, PermissionsEnum } from '@gauzy/models';
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
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationClientsEditByEmployeeCommand } from './commands/organization-clients.edit-by-employee.command';
import { OrganizationClients } from './organization-clients.entity';
import { OrganizationClientsService } from './organization-clients.service';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';

@ApiTags('Organization-Clients')
@Controller()
export class OrganizationClientsController extends CrudController<
	OrganizationClients
> {
	constructor(
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly commandBus: CommandBus
	) {
		super(organizationClientsService);
	}

	@ApiOperation({
		summary: 'Find all organization projects by Employee.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
		type: OrganizationClients
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('employee/:id')
	async findByEmployee(
		@Param('id') id: string
	): Promise<IPagination<OrganizationClients>> {
		return this.organizationClientsService.findByEmployee(id);
	}

	@ApiOperation({
		summary: 'Find all organization clients recurring expense.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found clients recurring expense',
		type: OrganizationClients
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<OrganizationClients>> {
		const { relations, findInput } = JSON.parse(data);

		return this.organizationClientsService.findAll({
			where: findInput,
			relations
		});
	}

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
	async updateEmployee(
		@Body() entity: EditEntityByMemberInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationClientsEditByEmployeeCommand(entity)
		);
	}
}
