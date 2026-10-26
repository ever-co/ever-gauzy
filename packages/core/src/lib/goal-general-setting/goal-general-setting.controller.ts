import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	Query,
	HttpCode,
	Put,
	Param,
	BadRequestException,
	Delete,
	UsePipes
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IGoalGeneralSetting, IPagination, PermissionsEnum, ID } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { GoalGeneralSetting } from './goal-general-setting.entity';
import { GoalGeneralSettingService } from './goal-general-setting.service';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { CreateGoalGeneralSettingDTO, UpdateGoalGeneralSettingDTO } from './dto';
import { Permissions } from './../shared/decorators';
import { TenantOrganizationBaseDTO } from './../core/dto';

@ApiTags('GoalGeneralSetting')
@UseGuards(TenantPermissionGuard)
@Controller('/goal-general-setting')
export class GoalGeneralSettingController extends CrudController<GoalGeneralSetting> {
	constructor(private readonly goalGeneralSettingService: GoalGeneralSettingService) {
		super(goalGeneralSettingService);
	}

	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IGoalGeneralSetting>> {
		const { findInput = null } = data;
		return this.goalGeneralSettingService.findAll({
			where: { ...findInput }
		});
	}

	@ApiOperation({ summary: 'Create Goal General Setting' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Goal general setting Created successfully',
		type: GoalGeneralSetting
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Post()
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateGoalGeneralSettingDTO): Promise<IGoalGeneralSetting> {
		return this.goalGeneralSettingService.create(entity);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
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
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateGoalGeneralSettingDTO
	): Promise<IGoalGeneralSetting> {
		try {
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			return await this.goalGeneralSettingService.create({ ...entity, id });
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could remove the row. It now states `GOALS_EDIT` (owner decision 2, 2026-10-22; GHSA-v79w-54p2-wmh5). The
	 * GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to delete.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Record deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return await super.delete(id);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could retire the row. It now states `GOALS_EDIT` (owner decision 2, 2026-10-22; GHSA-v79w-54p2-wmh5). The
	 * GraphQL field that mirrors it states the same.
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
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<GoalGeneralSetting> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could restore the row. It now states `GOALS_EDIT` (owner decision 2, 2026-10-22; GHSA-v79w-54p2-wmh5). The
	 * GraphQL field that mirrors it states the same.
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
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<GoalGeneralSetting> {
		return await super.softRecover(id, ...options);
	}
}
