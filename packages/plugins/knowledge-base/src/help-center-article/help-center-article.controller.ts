import { HelpCenterArticle } from './help-center-article.entity';
import { PermissionsEnum, IHelpCenterArticle } from '@gauzy/contracts';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Post,
	Body,
	UseGuards,
	Get,
	Param,
	Delete
} from '@nestjs/common';
import {
	Permissions,
	CrudController,
	TenantPermissionGuard,
	PermissionGuard,
	UUIDValidationPipe
} from '@gauzy/core';
import { AuthGuard } from '@nestjs/passport';
import { CommandBus } from '@nestjs/cqrs';
import { HelpCenterArticleService } from './help-center-article.service';
import { KnowledgeBaseCategoryBulkDeleteCommand } from './commands';

@ApiTags('KnowledgeBaseArticle')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
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
	async create(
		@Body() entity: IHelpCenterArticle
	): Promise<IHelpCenterArticle> {
		return this.helpCenterArticleService.create(entity);
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
	@UseGuards(PermissionGuard)
	@Get('category/:categoryId')
	async findByCategoryId(
		@Param('categoryId', UUIDValidationPipe) categoryId: string
	): Promise<IHelpCenterArticle[]> {
		return this.helpCenterArticleService.getArticlesByCategoryId(categoryId);
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
	async deleteBulkByCategoryId(
		@Param('categoryId', UUIDValidationPipe) categoryId: string
	): Promise<any> {
		return this.commandBus.execute(
			new KnowledgeBaseCategoryBulkDeleteCommand(categoryId)
		);
	}
}
