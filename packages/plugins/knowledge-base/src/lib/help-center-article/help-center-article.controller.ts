import { PermissionsEnum, IHelpCenterArticle, ID, IPagination, IHelpCenterArticleFiltering } from '@gauzy/contracts';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, HttpStatus, Post, Body, UseGuards, Get, Param, Delete, HttpCode, Put, Res, Query } from '@nestjs/common';
import {
	Permissions,
	CrudController,
	TenantPermissionGuard,
	PermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe,
	BaseQueryDTO
} from '@gauzy/core';
import { AuthGuard } from '@nestjs/passport';
import { CommandBus } from '@nestjs/cqrs';
import { Response } from 'express';
import { HelpCenterArticle } from './help-center-article.entity';
import { HelpCenterArticleService } from './help-center-article.service';
import { KnowledgeBaseCategoryBulkDeleteCommand } from './commands';
import { HelpCenterUpdateArticleCommand } from './commands/help-center-article.update.command';
import { UpdateHelpCenterArticleDTO } from './dto';

@ApiTags('KnowledgeBaseArticle')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller('/help-center-article')
export class HelpCenterArticleController extends CrudController<HelpCenterArticle> {
	constructor(
		private readonly helpCenterArticleService: HelpCenterArticleService,
		private readonly commandBus: CommandBus
	) {
		super(helpCenterArticleService);
	}

	@ApiOperation({
		summary: 'Create new article'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Success Add article',
		type: HelpCenterArticle
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Post()
	async create(@Body() entity: IHelpCenterArticle): Promise<IHelpCenterArticle> {
		return this.helpCenterArticleService.create(entity);
	}

	/**
	 * Create a copy of an article (without binary content).
	 */
	@ApiOperation({ summary: 'Duplicate an article' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Article duplicated.', type: HelpCenterArticle })
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post(':id/duplicate')
	async duplicate(@Param('id', UUIDValidationPipe) id: string): Promise<HelpCenterArticle> {
		return this.helpCenterArticleService.duplicate(id);
	}

	@ApiOperation({
		summary: 'Find articles By Category Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found category articles',
		type: HelpCenterArticle
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('category/:categoryId')
	async findByCategoryId(@Param('categoryId', UUIDValidationPipe) categoryId: ID): Promise<IHelpCenterArticle[]> {
		return this.helpCenterArticleService.getArticlesByCategoryId(categoryId);
	}

	@ApiOperation({
		summary: 'Find articles By Project Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found project articles',
		type: HelpCenterArticle
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('project/:projectId')
	@UseValidationPipe({ transform: true })
	async findByProjectId(
		@Param('projectId', UUIDValidationPipe) projectId: ID,
		@Query() options: BaseQueryDTO<HelpCenterArticle> & IHelpCenterArticleFiltering
	): Promise<IPagination<IHelpCenterArticle>> {
		return this.helpCenterArticleService.getArticlesByProjectId(projectId, options);
	}

	/**
	 * Returns the binary state as octet-stream.
	 * Returns an empty buffer if no binary is stored yet.
	 */
	@ApiOperation({ summary: 'Get article binary description' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Binary returned.' })
	@Get(':id/description')
	async getDescription(
		@Param('id', UUIDValidationPipe) id: string,
		@Res({ passthrough: true }) res: Response
	): Promise<void> {
		const binary = await this.helpCenterArticleService.getDescriptionBinary(id);
		res.setHeader('Content-Type', 'application/octet-stream');
		res.send(binary ?? new Uint8Array(0));
	}

	@ApiOperation({
		summary: 'Delete Articles By Category Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Deleted Articles By Category Id',
		type: HelpCenterArticle
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Delete('category/:categoryId')
	async deleteBulkByCategoryId(@Param('categoryId', UUIDValidationPipe) categoryId: string): Promise<any> {
		return this.commandBus.execute(new KnowledgeBaseCategoryBulkDeleteCommand(categoryId));
	}

	/**
	 * UPDATE Help Center Article By Id
	 *
	 * @param id
	 * @param updateInput
	 * @returns
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.OK,
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
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IHelpCenterArticle['id'],
		@Body() updateInput: UpdateHelpCenterArticleDTO
	): Promise<void> {
		return await this.commandBus.execute(new HelpCenterUpdateArticleCommand(id, updateInput));
	}
}
