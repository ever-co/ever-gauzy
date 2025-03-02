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
import { DeleteResult, UpdateResult } from 'typeorm';
import { IReaction, ID, IPagination } from '@gauzy/contracts';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { Reaction } from './reaction.entity';
import { ReactionService } from './reaction.service';
import { ReactionCreateCommand, ReactionUpdateCommand } from './commands';
import { CreateReactionDTO, UpdateReactionDTO } from './dto';

@ApiTags('Reactions')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/reaction')
export class ReactionController extends CrudController<Reaction> {
	constructor(private readonly reactionService: ReactionService, private readonly commandBus: CommandBus) {
		super(reactionService);
	}

	/**
	 * Retrieves a paginated list of reactions filtered by type.
	 *
	 * @param params - Pagination and filtering parameters for retrieving reactions.
	 * @returns A Promise resolving to a paginated list of reactions.
	 */
	@ApiOperation({ summary: 'Find all reactions filtered by type.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found reactions',
		type: Reaction
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<Reaction>): Promise<IPagination<IReaction>> {
		return await this.reactionService.findAll(params);
	}

	/**
	 * Retrieves a reaction by its unique identifier.
	 *
	 * @param id - The unique identifier of the reaction.
	 * @param params - Optional query parameters for filtering the reaction.
	 * @returns A Promise that resolves to the found Reaction.
	 * @throws NotFoundException if the reaction is not found.
	 */
	@ApiOperation({ summary: 'Find reaction by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: Reaction // Ensure that Reaction is imported and annotated properly
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: OptionParams<Reaction>
	): Promise<Reaction> {
		// Retrieve the reaction using the service
		return await this.reactionService.findOneByIdString(id, params);
	}

	/**
	 * Creates a new reaction.
	 *
	 * @param entity - The reaction data to create.
	 * @returns A promise that resolves with the created reaction.
	 */
	@ApiOperation({ summary: 'Create reaction' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the response body may contain clues as to what went wrong.'
	})
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	@HttpCode(HttpStatus.CREATED)
	async create(@Body() entity: CreateReactionDTO): Promise<IReaction> {
		return await this.commandBus.execute(new ReactionCreateCommand(entity));
	}

	/**
	 * Updates an existing reaction.
	 *
	 * @param id - The unique identifier of the reaction to update.
	 * @param entity - The updated reaction data.
	 * @returns The updated reaction.
	 */
	@ApiOperation({ summary: 'Update an existing reaction' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The reaction has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Reaction not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.OK)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateReactionDTO
	): Promise<IReaction | UpdateResult> {
		return await this.commandBus.execute(new ReactionUpdateCommand(id, entity));
	}

	/**
	 * Deletes a reaction by its ID, ensuring that it belongs to the current employee and tenant.
	 *
	 * @param id - The unique identifier of the reaction to be deleted.
	 * @returns A Promise that resolves with no content upon successful deletion.
	 * @throws NotFoundException if the reaction is not found.
	 */
	@ApiOperation({ summary: 'Delete a reaction by its ID' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The reaction has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Reaction not found.'
	})
	@Delete('/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		// The reactionService.delete method should throw an exception if deletion fails.
		return await this.reactionService.delete(id);
	}
}
