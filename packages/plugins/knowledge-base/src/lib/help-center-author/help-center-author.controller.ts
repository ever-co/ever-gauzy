import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AuthGuard } from '@nestjs/passport';
import { HelpCenterAuthor } from './help-center-author.entity';
import { HelpCenterAuthorService } from './help-center-author.service';
import { CommandBus } from '@nestjs/cqrs';
import { ArticleAuthorsBulkCreateCommand, KnowledgeBaseArticleBulkDeleteCommand } from './commands';
import {
	AbstractValidationPipe,
	CrudController,
	ParseJsonPipe,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe
} from '@gauzy/core';
import { ID, IHelpCenterAuthor, IPagination, PermissionsEnum } from '@gauzy/contracts';

@ApiTags('KnowledgeBaseAuthor')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller('/help-center-author')
export class HelpCenterAuthorController extends CrudController<HelpCenterAuthor> {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly helpCenterAuthorService: HelpCenterAuthorService
	) {
		super(helpCenterAuthorService);
	}
	@ApiOperation({
		summary: 'Find authors By Article Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found article authors',
		type: HelpCenterAuthor
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('article/:articleId')
	async findByArticleId(@Param('articleId', UUIDValidationPipe) articleId: string): Promise<IHelpCenterAuthor[]> {
		return this.helpCenterAuthorService.findByArticleId(articleId);
	}

	@ApiOperation({
		summary: 'Delete Authors By Article Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found article authors',
		type: HelpCenterAuthor
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Delete('article/:articleId')
	async deleteBulkByArticleId(@Param('articleId', UUIDValidationPipe) articleId: string): Promise<any> {
		return await this.commandBus.execute(new KnowledgeBaseArticleBulkDeleteCommand(articleId));
	}

	@ApiOperation({
		summary: 'Find all authors.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found authors',
		type: HelpCenterAuthor
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IHelpCenterAuthor>> {
		const { relations = [], findInput = null } = data;
		return this.helpCenterAuthorService.findAll({
			relations,
			where: findInput
		});
	}

	@ApiOperation({ summary: 'Create authors in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Authors have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Post('createBulk')
	async createBulk(@Body() input: any): Promise<IHelpCenterAuthor[]> {
		return this.commandBus.execute(new ArticleAuthorsBulkCreateCommand(input));
	}

	/**
	 * CREATE an article author row
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach the permission gate:
	 * `PermissionGuard` authorizes any route that carries no `@Permissions` metadata, so an
	 * inherited handler is reachable by every member of the tenant until it is gated here.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The record has been successfully created.' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Post()
	async create(@Body() entity: DeepPartial<HelpCenterAuthor>): Promise<HelpCenterAuthor> {
		return super.create(entity);
	}

	/**
	 * UPDATE an article author row by id
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach the permission gate.
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully edited.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<HelpCenterAuthor>
	): Promise<any> {
		return super.update(id, entity);
	}

	/**
	 * DELETE an article author row by id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully deleted' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE an article author row by id
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach the permission gate.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<HelpCenterAuthor> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted article author row by id
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach the permission gate.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<HelpCenterAuthor> {
		return super.softRecover(id, ...options);
	}
}
