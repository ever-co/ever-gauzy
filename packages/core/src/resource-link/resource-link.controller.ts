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
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { IResourceLink, IResourceLinkUpdateInput, ID, IPagination } from '@gauzy/contracts';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { ResourceLink } from './resource-link.entity';
import { ResourceLinkService } from './resource-link.service';
import { ResourceLinkCreateCommand, ResourceLinkUpdateCommand } from './commands';
import { CreateResourceLinkDTO, UpdateResourceLinkDTO } from './dto';

@ApiTags('Resource Links')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller()
export class ResourceLinkController extends CrudController<ResourceLink> {
	constructor(private readonly resourceLinkService: ResourceLinkService, private readonly commandBus: CommandBus) {
		super(resourceLinkService);
	}

	@ApiOperation({
		summary: 'Find all resource links filtered by type.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found resource links',
		type: ResourceLink
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<ResourceLink>): Promise<IPagination<IResourceLink>> {
		return await this.resourceLinkService.findAll(params);
	}

	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: OptionParams<ResourceLink>
	): Promise<ResourceLink> {
		return this.resourceLinkService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Create a resource link' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateResourceLinkDTO): Promise<IResourceLink> {
		return await this.commandBus.execute(new ResourceLinkCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Update an existing resource link' })
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
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateResourceLinkDTO
	): Promise<IResourceLinkUpdateInput> {
		return await this.commandBus.execute(new ResourceLinkUpdateCommand(id, entity));
	}

	@ApiOperation({ summary: 'Delete resource' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.resourceLinkService.delete(id);
	}
}
