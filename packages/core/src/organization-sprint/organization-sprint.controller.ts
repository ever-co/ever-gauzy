import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	Request,
	UseGuards,
	Post
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { OrganizationSprint } from './organization-sprint.entity';
import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationProject } from '../organization-projects/organization-projects.entity';
import { IOrganizationSprint, IOrganizationSprintUpdateInput, IPagination } from '@gauzy/contracts';
import { OrganizationSprintUpdateCommand } from './commands/organization-sprint.update.command';
import { CommandBus } from '@nestjs/cqrs';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('OrganizationSprint')
@UseGuards(TenantPermissionGuard)
@Controller()
export class OrganizationSprintController extends CrudController<OrganizationSprint> {
	constructor(
		private readonly organizationSprintService: OrganizationSprintService,
		private readonly commandBus: CommandBus
	) {
		super(organizationSprintService);
	}

	@ApiOperation({
		summary: 'Find all organization sprint.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found projects',
		type: OrganizationProject
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllSprints(
		@Query('data', ParseJsonPipe) data: any,
		@Request() req
	): Promise<IPagination<IOrganizationSprint>> {
		const { relations, findInput } = data;
		return this.organizationSprintService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	async createOrganizationSprint(
		@Body() entity: OrganizationSprint,
		...options: any[]
	): Promise<any> {
		return this.organizationSprintService.create(entity);
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
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IOrganizationSprintUpdateInput
	): Promise<any> {
		return this.commandBus.execute(
			new OrganizationSprintUpdateCommand(id, entity)
		);
	}
}
