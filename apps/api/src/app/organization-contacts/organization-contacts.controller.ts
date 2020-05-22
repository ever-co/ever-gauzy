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
import { OrganizationContactsEditByEmployeeCommand } from './commands/organization-contacts.edit-by-employee.command';
import { OrganizationContacts } from './organization-contacts.entity';
import { OrganizationContactsService } from './organization-contacts.service';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Organization-Contact')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrganizationContactsController extends CrudController<
	OrganizationContacts
> {
	constructor(
		private readonly organizationContactService: OrganizationContactsService,
		private readonly commandBus: CommandBus
	) {
		super(organizationContactService);
	}

	@ApiOperation({
		summary: 'Find all organization projects by Employee.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
		type: OrganizationContacts
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('employee/:id')
	async findByEmployee(
		@Param('id') id: string
	): Promise<IPagination<OrganizationContacts>> {
		return this.organizationContactService.findByEmployee(id);
	}

	@ApiOperation({
		summary: 'Find all organization contacts recurring expense.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found contacts recurring expense',
		type: OrganizationContacts
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<OrganizationContacts>> {
		const { relations, findInput } = JSON.parse(data);

		return this.organizationContactService.findAll({
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
			new OrganizationContactsEditByEmployeeCommand(entity)
		);
	}
}
