import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocumentShare, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { CreateDocumentShareDTO, UpdateDocumentShareDTO } from '../dto/document-share.dto';
import { DocumentShare } from '../entities/document-share.entity';
import { DocumentShareService } from '../services/document-share.service';

/**
 * The share overlay of PRIVATE documents (`03-backend-plugin.md` §4.12).
 *
 * Guards prove the verb (`DOCS_READ` to list, `DOCS_UPDATE` to mutate); the service proves
 * the verb is allowed on this row — creator-or-`DOCS_MANAGE` only, PRIVATE documents only.
 * A document the caller cannot read is a 404, never a 403.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs')
export class DocumentShareController {
	constructor(private readonly documentShareService: DocumentShareService) {}

	/**
	 * Lists the share overlay of one document (creator / `DOCS_MANAGE` only).
	 */
	@ApiOperation({ summary: 'List the shares of one document.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Shares retrieved successfully.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not the creator and not a DOCS_MANAGE holder.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found or not readable.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@Get('/documents/:id/shares')
	public async findAll(@Param('id', UUIDValidationPipe) id: ID): Promise<IPagination<IDocumentShare>> {
		return this.documentShareService.findAllForDocument(id);
	}

	/**
	 * Shares a PRIVATE document with one employee XOR one team.
	 */
	@ApiOperation({ summary: 'Share a PRIVATE document with an employee or a team.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Share created successfully.', type: DocumentShare })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Both or neither of employeeId/teamId supplied.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'Document is not PRIVATE, or the share already exists.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/documents/:id/shares')
	public async create(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: CreateDocumentShareDTO
	): Promise<IDocumentShare> {
		return this.documentShareService.createShare(id, input);
	}

	/**
	 * Changes the access level of one share row.
	 */
	@ApiOperation({ summary: 'Update the access level of a document share.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Share updated successfully.', type: DocumentShare })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Share not found on this document.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Put('/documents/:id/shares/:shareId')
	public async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('shareId', UUIDValidationPipe) shareId: ID,
		@Body() input: UpdateDocumentShareDTO
	): Promise<IDocumentShare> {
		return this.documentShareService.updateShare(id, shareId, input);
	}

	/**
	 * Revokes one share row.
	 */
	@ApiOperation({ summary: 'Revoke a document share.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Share revoked successfully.', type: DocumentShare })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Share not found on this document.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@Delete('/documents/:id/shares/:shareId')
	public async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('shareId', UUIDValidationPipe) shareId: ID
	): Promise<IDocumentShare> {
		return this.documentShareService.deleteShare(id, shareId);
	}
}
