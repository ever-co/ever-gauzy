import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { Controller, HttpStatus, Get, Query, UseGuards, HttpCode, Post, Body, Param, Put, Delete, UsePipes } from '@nestjs/common';
import { FindOptionsWhere, UpdateResult } from 'typeorm';
import { ID, IPagination, ITagType, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from '../core/crud';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TagType } from './tag-type.entity';
import { TagTypeService } from './tag-type.service';
import { Permissions, UseValidationPipe, UUIDValidationPipe } from '../shared';
import { CreateTagTypeDTO, UpdateTagTypeDTO } from './dto';
import { AbstractValidationPipe } from '../shared/pipes';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('TagTypes')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/tag-types')
export class TagTypeController extends CrudController<TagType> {
	constructor(private readonly tagTypesService: TagTypeService) {
		super(tagTypesService);
	}

	/**
	 * GET tag types count
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find Tag Types Count ' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Count Tag Types',
		type: TagType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TAG_TYPES_VIEW)
	@Get('/count')
	async getCount(@Query() options: FindOptionsWhere<TagType>): Promise<number> {
		return await this.tagTypesService.countBy(options);
	}

	/**
	 * GET all tag types
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all tag types.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tag types.',
		type: TagType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TAG_TYPES_VIEW)
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() options: BaseQueryDTO<TagType>): Promise<IPagination<TagType>> {
		return await this.tagTypesService.findAll(options);
	}

	/**
	 * Create new tag type
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAG_TYPES_ADD)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateTagTypeDTO): Promise<ITagType> {
		return this.tagTypesService.create(entity);
	}

	/**
	 * Update existing tag Type by ID
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAG_TYPES_EDIT)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateTagTypeDTO
	): Promise<ITagType | UpdateResult> {
		return this.tagTypesService.update(id, entity);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `ALL_ORG_EDIT` or `ORG_TAG_TYPES_DELETE`: the tag-type
	 * catalogue's delete grant, beside `ALL_ORG_EDIT`, which its create and update routes accept too
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAG_TYPES_DELETE)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TagType> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `ALL_ORG_EDIT` or `ORG_TAG_TYPES_DELETE`: the tag-type
	 * catalogue's delete grant, beside `ALL_ORG_EDIT`, which its create and update routes accept too
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAG_TYPES_DELETE)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<TagType> {
		return await super.softRecover(id, ...options);
	}
}
