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
import { IReaction, IReactionUpdateInput, ID, IPagination } from '@gauzy/contracts';
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

	@ApiOperation({
		summary: 'Find all reactions filtered by type.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found reactions',
		type: Reaction
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<Reaction>): Promise<IPagination<IReaction>> {
		return await this.reactionService.findAll(params);
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
		@Query() params: OptionParams<Reaction>
	): Promise<Reaction> {
		return this.reactionService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Create reaction' })
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
	async create(@Body() entity: CreateReactionDTO): Promise<IReaction> {
		return await this.commandBus.execute(new ReactionCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Update an existing reaction' })
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
		@Body() entity: UpdateReactionDTO
	): Promise<IReactionUpdateInput> {
		return await this.commandBus.execute(new ReactionUpdateCommand(id, entity));
	}

	@ApiOperation({ summary: 'Delete reaction' })
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
		return await this.reactionService.delete(id);
	}
}
