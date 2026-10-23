import {
	Controller,
	HttpStatus,
	Get,
	Post,
	Body,
	HttpCode,
	Put,
	Param,
	UseGuards,
	Delete,
	Query,
	UsePipes
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { IGoal, IPagination, PermissionsEnum, ID } from '@gauzy/contracts';
import { GoalService } from './goal.service';
import { Goal } from './goal.entity';
import { CrudController } from './../core/crud';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { CreateGoalDTO, UpdateGoalDTO } from './dto';
import { Permissions } from './../shared/decorators';
import { TenantOrganizationBaseDTO } from './../core/dto';

@ApiTags('Goals')
@UseGuards(TenantPermissionGuard)
@Controller('/goals')
export class GoalController extends CrudController<Goal> {
	constructor(private readonly goalService: GoalService) {
		super(goalService);
	}

	@ApiOperation({ summary: 'Create Goal' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Goal Created successfully',
		type: Goal
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Post()
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateGoalDTO): Promise<IGoal> {
		return this.goalService.create(entity);
	}

	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IGoal>> {
		const { relations, findInput } = data;
		return this.goalService.findAll({
			where: { ...findInput },
			relations,
			order: { createdAt: 'ASC' }
		});
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
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateGoalDTO): Promise<IGoal> {
		// This is an update-through-create, so an id that matches nothing would be INSERTed as a new
		// row — and fail on a NOT NULL column, answering 400 with the raw SQL in the body.
		// `findOneByIdString` throws NotFoundException when the row is not in the caller's tenant, so
		// this call turns that into a clean 404.
		await this.goalService.findOneByIdString(id);

		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		//
		//Errors are NOT swallowed: `create()` now rejects a cross-tenant write with ForbiddenException,
		//and returning `undefined` would answer a refused write with 202 and an empty body.
		return await this.goalService.create({ ...entity, id });
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<DeleteResult> {
		return this.goalService.delete(id);
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
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Goal> {
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
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<Goal> {
		return await super.softRecover(id, ...options);
	}
}
