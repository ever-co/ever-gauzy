import { HelpCenterArticle } from './help-center-article.entity';
import { PermissionsEnum, IHelpCenterArticle } from '@gauzy/models';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Post,
	Body,
	UseGuards,
	Get,
	Param,
	Delete,
	Query
} from '@nestjs/common';
import { CrudController } from '../core';
import { ParseJsonPipe } from '../shared';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { HelpCenterArticleService } from './help-center-article.service';
import { KnowledgeBaseCategoryBulkDeleteCommand } from './commands';
import { CommandBus } from '@nestjs/cqrs';

@ApiTags('knowledge_base_article')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class HelpCenterArticleController extends CrudController<
	HelpCenterArticle
> {
	constructor(
		private readonly helpCenterService: HelpCenterArticleService,
		private readonly commandBus: CommandBus
	) {
		super(helpCenterService);
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
	async createNode(@Body() entity: IHelpCenterArticle): Promise<any> {
		return this.helpCenterService.create(entity);
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
	@Get(':categoryId')
	async findByCategoryId(
		@Param('categoryId') categoryId: string
	): Promise<HelpCenterArticle[]> {
		return this.helpCenterService.getArticlesByCategoryId(categoryId);
	}

	@ApiOperation({
		summary: 'Delete Articles By Category Id.'
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
	@Delete('deleteBulkByCategoryId')
	async deleteBulkByCategoryId(
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { id = null } = data;
		return this.commandBus.execute(
			new KnowledgeBaseCategoryBulkDeleteCommand(id)
		);
	}
}
