import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Put,
	Query,
	UseGuards,
	Post
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	IOrganizationSprint,
	IOrganizationSprintUpdateInput,
	IPagination
} from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { OrganizationSprint } from './organization-sprint.entity';
import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationSprintUpdateCommand } from './commands';
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

	/**
	 * GET all organization sprints
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find all organization sprint.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization sprints',
		type: OrganizationSprint
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IOrganizationSprint>> {
		const { relations, findInput } = data;
		return this.organizationSprintService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * CREATE organization sprint
	 * 
	 * @param entity 
	 * @param options 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	async create(
		@Body() body: OrganizationSprint,
		...options: any[]
	): Promise<IOrganizationSprint> {
		return this.organizationSprintService.create(body);
	}

	/**
	 * UPDATE organization sprint by id
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: IOrganizationSprintUpdateInput
	): Promise<IOrganizationSprint> {
		return this.commandBus.execute(
			new OrganizationSprintUpdateCommand(id, body)
		);
	}
}
