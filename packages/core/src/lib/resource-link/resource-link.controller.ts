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
@Controller('/resource-link')
export class ResourceLinkController extends CrudController<ResourceLink> {
	constructor(private readonly resourceLinkService: ResourceLinkService, private readonly commandBus: CommandBus) {
		super(resourceLinkService);
	}

	/**
	 * @description Retrieves all resource links, optionally filtered by type.
	 * This endpoint supports pagination and returns a list of resource links.
	 *
	 * @param {PaginationParams<ResourceLink>} params - The pagination and filter parameters.
	 * @returns {Promise<IPagination<IResourceLink>>} - A promise that resolves to a paginated list of resource links.
	 * @memberof ResourceLinkController
	 */
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
		// Call the service to retrieve the paginated list of resource links
		return await this.resourceLinkService.findAll(params);
	}

	/**
	 * @description Retrieves a single resource link by its ID.
	 * This endpoint returns a resource link by its unique identifier, optionally filtered by query parameters.
	 *
	 * @param {ID} id - The unique identifier of the resource link to retrieve.
	 * @param {OptionParams<ResourceLink>} params - The optional query parameters for filtering or additional options.
	 * @returns {Promise<ResourceLink>} - A promise that resolves to the found resource link.
	 * @memberof ResourceLinkController
	 */
	@ApiOperation({ summary: 'Find resource link by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one resource link'
		// type: ResourceLink // Uncomment and specify the type if needed for API documentation
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Resource link not found'
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID, // Validate and retrieve the ID parameter
		@Query() params: OptionParams<ResourceLink> // Retrieve optional query parameters
	): Promise<ResourceLink> {
		// Call the service to find the resource link by ID, applying optional filters if present
		return this.resourceLinkService.findOneByIdString(id, params);
	}

	/**
	 * @description Creates a new resource link.
	 * This endpoint receives the data for a resource link, validates it, and creates a new record.
	 *
	 * @param {CreateResourceLinkDTO} entity - The data to create a new resource link.
	 * @returns {Promise<IResourceLink>} - A promise that resolves to the created resource link.
	 * @memberof ResourceLinkController
	 */
	@ApiOperation({ summary: 'Create a new resource link' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The resource link has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain details on what went wrong.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateResourceLinkDTO): Promise<IResourceLink> {
		// Execute the command to create the resource link
		return await this.commandBus.execute(new ResourceLinkCreateCommand(entity));
	}

	/**
	 * @description Updates an existing resource link by its ID.
	 * This endpoint receives the updated data for a resource link and updates the record in the database.
	 *
	 * @param {ID} id - The unique identifier of the resource link to update.
	 * @param {UpdateResourceLinkDTO} entity - The data to update the resource link.
	 * @returns {Promise<IResourceLinkUpdateInput>} - A promise that resolves to the updated resource link.
	 * @memberof ResourceLinkController
	 */
	@ApiOperation({ summary: 'Update an existing resource link' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The resource link has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The resource link was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain details about what went wrong.'
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

	/**
	 * @description Deletes a resource link by its ID.
	 * This endpoint deletes an existing resource link record from the database.
	 *
	 * @param {ID} id - The unique identifier of the resource link to delete.
	 * @returns {Promise<DeleteResult>} - A promise that resolves to the result of the delete operation.
	 * @memberof ResourceLinkController
	 */
	@ApiOperation({ summary: 'Delete a resource link' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The resource link has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The resource link was not found.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		// Execute the delete operation and return the result
		return await this.resourceLinkService.delete(id);
	}
}
