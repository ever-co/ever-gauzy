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
import { IComment, ID, IPagination } from '@gauzy/contracts';
import { CrudController, OptionParams, PaginationParams } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Comment } from './comment.entity';
import { CommentService } from './comment.service';
import { CommentCreateCommand, CommentUpdateCommand } from './commands';
import { CreateCommentDTO, UpdateCommentDTO } from './dto';

@ApiTags('Comments')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/comment')
export class CommentController extends CrudController<Comment> {
	constructor(private readonly commentService: CommentService, private readonly commandBus: CommandBus) {
		super(commentService);
	}

	/**
	 * Finds all comments filtered by type (or other criteria) with pagination.
	 *
	 * @param params - Pagination and filter parameters.
	 * @returns A promise that resolves with paginated comments.
	 */
	@ApiOperation({ summary: 'Find all comments filtered by type.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found comments',
		type: Comment
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<Comment>): Promise<IPagination<IComment>> {
		return await this.commentService.findAll(params);
	}

	/**
	 * Finds a comment by its id.
	 *
	 * @param id - The id of the comment.
	 * @param params - Optional parameters (e.g., relations to load).
	 * @returns The found comment record.
	 */
	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/:id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() params: OptionParams<Comment>): Promise<Comment> {
		return this.commentService.findOneByIdString(id, params);
	}

	/**
	 * Creates a new comment using the provided DTO.
	 *
	 * @param createCommentDto - Data transfer object containing comment data.
	 * @returns A promise resolving to the created comment.
	 */
	@ApiOperation({ summary: 'Create/Post a comment' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateCommentDTO): Promise<IComment> {
		return await this.commandBus.execute(new CommentCreateCommand(entity));
	}

	/**
	 * Updates an existing comment identified by the provided id.
	 *
	 * @param id - The unique identifier of the comment.
	 * @param updateCommentDto - The data transfer object containing update data.
	 * @returns The updated comment.
	 * @throws NotFoundException if the comment does not exist.
	 */
	@ApiOperation({ summary: 'Update an existing comment' })
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
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateCommentDTO): Promise<IComment> {
		return await this.commandBus.execute(new CommentUpdateCommand(id, entity));
	}

	/**
	 * Deletes a comment identified by the given id.
	 *
	 * @param id - The unique identifier of the comment to delete.
	 * @returns A promise resolving to the result of the delete operation.
	 * @throws NotFoundException if the comment is not found.
	 */
	@ApiOperation({ summary: 'Delete comment' })
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
		return await this.commentService.delete(id);
	}
}
