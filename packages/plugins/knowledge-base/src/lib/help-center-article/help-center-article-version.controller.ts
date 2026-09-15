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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DeepPartial, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID, IHelpCenterArticle, IHelpCenterArticleVersion, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	BaseQueryDTO
} from '@gauzy/core';
import { HelpCenterArticleVersion } from './help-center-article-version.entity';
import { HelpCenterArticleVersionService } from './help-center-article-version.service';

/**
 * Controller for HelpCenterArticleVersion.
 *
 * Versions are created automatically when articles are updated via updateWithVersioning().
 * This controller provides read-only access + restore functionality.
 */
@ApiTags('KnowledgeBaseArticleVersion')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller('/help-center-article-version')
export class HelpCenterArticleVersionController extends CrudController<HelpCenterArticleVersion> {
	constructor(private readonly articleVersionService: HelpCenterArticleVersionService) {
		super(articleVersionService);
	}

	/**
	 * Get all versions (with optional filtering by articleId)
	 * Usage: GET /?where[articleId]=xxx&order[lastSavedAt]=DESC
	 */
	@ApiOperation({ summary: 'Get all versions' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Versions retrieved successfully',
		type: HelpCenterArticleVersion,
		isArray: true
	})
	@Get()
	async findAll(
		@Query() options: BaseQueryDTO<HelpCenterArticleVersion>
	): Promise<IPagination<HelpCenterArticleVersion>> {
		return this.articleVersionService.findAll(options);
	}

	/**
	 * Get a specific version by ID
	 */
	@ApiOperation({ summary: 'Get version by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Version retrieved successfully',
		type: HelpCenterArticleVersion
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Version not found'
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: BaseQueryDTO<HelpCenterArticleVersion>
	): Promise<IHelpCenterArticleVersion> {
		return this.articleVersionService.findOneByIdString(id, options);
	}

	/**
	 * Restore an article to a specific version's content.
	 * Copies the version's descriptionHtml/Json back to the article.
	 */
	@ApiOperation({ summary: 'Restore article to a specific version' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Article restored to version successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Version not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Post(':id/restore')
	async restoreVersion(@Param('id', UUIDValidationPipe) versionId: ID): Promise<IHelpCenterArticle | UpdateResult> {
		return this.articleVersionService.restoreToVersion(versionId);
	}

	/**
	 * CREATE an article version row
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
	async create(@Body() entity: DeepPartial<HelpCenterArticleVersion>): Promise<HelpCenterArticleVersion> {
		return super.create(entity);
	}

	/**
	 * UPDATE an article version row by id
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach the permission gate.
	 * A stored version is what `POST :id/restore` copies back into the article, so rewriting one is
	 * a write to the article's content by another name.
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully edited.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<HelpCenterArticleVersion>
	): Promise<any> {
		return super.update(id, entity);
	}

	/**
	 * DELETE an article version row by id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate.
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
	 * SOFT DELETE an article version row by id
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
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<HelpCenterArticleVersion> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted article version row by id
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
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<HelpCenterArticleVersion> {
		return super.softRecover(id, ...options);
	}
}
