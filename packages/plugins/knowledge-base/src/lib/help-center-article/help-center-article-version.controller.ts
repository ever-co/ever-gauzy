import { Controller, Get, Param, Post, Query, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UpdateResult } from 'typeorm';
import { ID, IHelpCenterArticle, IHelpCenterArticleVersion, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
    CrudController,
    Permissions,
    PermissionGuard,
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
	async restoreVersion(
		@Param('id', UUIDValidationPipe) versionId: ID
	): Promise<IHelpCenterArticle | UpdateResult> {
		return this.articleVersionService.restoreToVersion(versionId);
	}
}
