import {
	Body,
	Controller,
	Get,
	Param,
	UseGuards,
	Delete,
	HttpCode,
	HttpStatus,
	Post,
	Put,
	UsePipes
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CrudController } from './../core/crud';
import { Skill } from './skill.entity';
import { SkillService } from './skill.service';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { AbstractValidationPipe, UUIDValidationPipe } from '../shared/pipes';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('Skills')
@UseGuards(TenantPermissionGuard)
@Controller('/skills')
export class SkillController extends CrudController<Skill> {
	constructor(private readonly skillService: SkillService) {
		super(skillService);
	}

	@Get('getByName/:name')
	async findByName(@Param('name') name: string): Promise<Skill> {
		return this.skillService.findOneByName(name);
	}

	/**
	 * Creates a skill.
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach a permission. The base declares the
	 * route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could add to the skills vocabulary (GHSA-v79w-54p2-wmh5). It now states `SKILLS_EDIT`, the skills write
	 * grant (owner decision 2, 2026-10-22). The GraphQL field that mirrors it states the same.
	 *
	 * @param entity The skill to create.
	 * @returns The created skill.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record created successfully' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.SKILLS_EDIT)
	@Post()
	async create(@Body() entity: DeepPartial<Skill>, ...options: any[]): Promise<Skill> {
		return await super.create(entity, ...options);
	}

	/**
	 * Updates a skill.
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach a permission, for the same reason as
	 * `create()`: it now states `SKILLS_EDIT`. The base still strips the members a body never writes.
	 *
	 * @param id The skill to update.
	 * @param entity The members to change.
	 * @returns The store's update result.
	 */
	@ApiOperation({ summary: 'Update existing record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record updated successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided for update' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.SKILLS_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: QueryDeepPartialEntity<Skill>,
		...options: any[]
	): Promise<any> {
		return await super.update(id, entity, ...options);
	}

	/**
	 * Deletes a skill.
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach a permission, for the same reason as
	 * `create()`: it now states `SKILLS_EDIT`.
	 *
	 * @param id The skill to delete.
	 * @returns The store's delete result.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Record deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.SKILLS_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.delete(id, ...options);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row (GHSA-v79w-54p2-wmh5). It states `SKILLS_EDIT`, the grant every other
	 * write of this controller states (owner decision 2, 2026-10-22; it stated `ALL_ORG_EDIT` before that grant
	 * existed). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.SKILLS_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Skill> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row (GHSA-v79w-54p2-wmh5). It states `SKILLS_EDIT`, the grant every other
	 * write of this controller states (owner decision 2, 2026-10-22; it stated `ALL_ORG_EDIT` before that grant
	 * existed). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.SKILLS_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Skill> {
		return await super.softRecover(id, ...options);
	}
}
