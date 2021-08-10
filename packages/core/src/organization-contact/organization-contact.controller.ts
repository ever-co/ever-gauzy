import { IEditEntityByMemberInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { CrudController } from './../core/crud';
import { OrganizationContactEditByEmployeeCommand } from './commands';
import { OrganizationContact } from './organization-contact.entity';
import { OrganizationContactService } from './organization-contact.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

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

	@ApiOperation({
		summary: 'Find all organization projects by Employee.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
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
	): Promise<IPagination<OrganizationContact>> {
		return this.organizationContactService.findByEmployee(id, data);
	}

	@ApiOperation({
		summary: 'Find all organization contacts recurring expense.'
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
	async findAllOrganizationContacts(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<OrganizationContact>> {
		return this.organizationContactService.findAllOrganizationContacts(
			data
		);
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
		@Body() entity: IEditEntityByMemberInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationContactEditByEmployeeCommand(entity)
		);
	}
}
