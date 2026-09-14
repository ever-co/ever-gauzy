import { PermissionsEnum, IHelpCenterArticle, ID, IPagination, IHelpCenterArticleFiltering } from '@gauzy/contracts';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Put,
	Query,
	Req,
	Res,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CommandBus } from '@nestjs/cqrs';
import { Response, Request } from 'express';
import {
	Permissions,
	AbstractValidationPipe,
	CrudController,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	PermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe,
	BaseQueryDTO
} from '@gauzy/core';
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
	 * Returns the Y.js binary state as application/octet-stream.
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
		res.send(binary ?? Buffer.alloc(0));
	}

	/**
	 * Upload raw binary description (application/octet-stream).
	 * Bypasses JSON serialization so Uint8Array is stored correctly in the DB.
	 */
	@ApiOperation({ summary: 'Upload binary description (octet-stream)' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Binary saved.' })
	@HttpCode(HttpStatus.OK)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Put(':id/binary-description')
	async uploadBinaryDescription(@Param('id', UUIDValidationPipe) id: string, @Req() req: Request): Promise<void> {
		const binary = await this.helpCenterArticleService.readBinaryStream(req);
		await this.commandBus.execute(new HelpCenterUpdateArticleCommand(id, { descriptionBinary: binary as any }));
	}

	/**
	 * Atomic update of all description fields (binary, HTML, JSON).
	 *
	 * Binary content is received as a base64-encoded string and decoded server-side.
	 * Uses a direct QueryBuilder update to bypass TypeORM's QueryDeepPartialEntity
	 * typing, which silently drops Buffer values for Uint8Array-typed entity fields.
	 */
	@ApiOperation({ summary: 'Atomic update of all description fields (binary + HTML + JSON)' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Description updated.' })
	@HttpCode(HttpStatus.OK)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Patch(':id/description')
	async patchDescription(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { descriptionBinary?: string; descriptionHtml?: string; descriptionJson?: any }
	): Promise<void> {
		await this.helpCenterArticleService.updateDescriptionFields(id, {
			descriptionBinary: body.descriptionBinary ? Buffer.from(body.descriptionBinary, 'base64') : undefined,
			descriptionHtml: body.descriptionHtml,
			descriptionJson:
				body.descriptionJson !== undefined
					? typeof body.descriptionJson === 'string'
						? body.descriptionJson
						: JSON.stringify(body.descriptionJson)
					: undefined
		});
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IHelpCenterArticle['id'],
		@Body() updateInput: UpdateHelpCenterArticleDTO
	): Promise<void> {
		return await this.commandBus.execute(new HelpCenterUpdateArticleCommand(id, updateInput));
	}

	/**
	 * DELETE Help Center Article By Id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate:
	 * `PermissionGuard` authorizes any route that carries no `@Permissions` metadata, so an
	 * inherited handler is reachable by every member of the tenant until it is gated here. This is
	 * the route the Angular Help Center uses to delete an article.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The record has been successfully deleted' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE Help Center Article By Id
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
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<HelpCenterArticle> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted Help Center Article By Id
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
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<HelpCenterArticle> {
		return super.softRecover(id, ...options);
	}
}
