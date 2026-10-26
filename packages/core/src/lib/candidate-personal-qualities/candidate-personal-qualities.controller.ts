import { Controller, UseGuards, Post, Body, Delete, Param, Get, Query, HttpStatus, HttpCode, Put, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import {
	RolesEnum,
	ICandidatePersonalQualities,
	IPagination,
	ICandidatePersonalQualitiesCreateInput,
	ID
} from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { RoleGuard, TenantPermissionGuard } from './../shared/guards';
import { Roles } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { CandidatePersonalQualities } from './candidate-personal-qualities.entity';
import { CandidatePersonalQualitiesService } from './candidate-personal-qualities.service';
import { CandidatePersonalQualitiesBulkCreateCommand, CandidatePersonalQualitiesBulkDeleteCommand } from './commands';
import { TenantOrganizationBaseDTO } from '../core/dto';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@ApiTags('CandidatePersonalQuality')
@UseGuards(TenantPermissionGuard)
@Controller('/candidate-personal-qualities')
export class CandidatePersonalQualitiesController extends CrudController<CandidatePersonalQualities> {
	constructor(
		private readonly candidatePersonalQualitiesService: CandidatePersonalQualitiesService,
		private readonly commandBus: CommandBus
	) {
		super(candidatePersonalQualitiesService);
	}

	/**
	 * GET candidate personal qualities by interview id
	 *
	 * @param interviewId
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Get('interview/:interviewId')
	async findByInterviewId(
		@Param('interviewId', UUIDValidationPipe) interviewId: string
	): Promise<ICandidatePersonalQualities[]> {
		return this.candidatePersonalQualitiesService.getPersonalQualitiesByInterviewId(interviewId);
	}

	/**
	 * DELETE bulk candidate personal qualities by id
	 *
	 * @param id
	 * @param data
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete('bulk/:id')
	async deleteBulk(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { personalQualities = null } = data;
		return this.commandBus.execute(new CandidatePersonalQualitiesBulkDeleteCommand(id, personalQualities));
	}

	/**
	 * CREATE bulk candidate personal qualities
	 *
	 * @param body
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post('bulk')
	async createBulk(@Body() body: any): Promise<ICandidatePersonalQualities[]> {
		const { interviewId = null, personalQualities = [] } = body;
		return this.commandBus.execute(new CandidatePersonalQualitiesBulkCreateCommand(interviewId, personalQualities));
	}

	/**
	 * GET all candidate personal qualities
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all candidate personal qualities.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate personal qualities',
		type: CandidatePersonalQualities
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Get()
	findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<ICandidatePersonalQualities>> {
		const { findInput, relations } = data;
		return this.candidatePersonalQualitiesService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * CREATE candidate personal quality
	 *
	 * @param data
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post()
	async create(@Body() data: ICandidatePersonalQualitiesCreateInput): Promise<ICandidatePersonalQualities> {
		return this.candidatePersonalQualitiesService.create(data);
	}

	/**
	 * DELETE candidate personal qualities by id
	 *
	 * @param id
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete(':id')
	delete(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.candidatePersonalQualitiesService.delete(id);
	}

	/**
	 * Updates personal qualities.
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach its role guard. Every other write of
	 * this controller runs under `RoleGuard` for `CANDIDATE`, `SUPER_ADMIN` and `ADMIN`, but the inherited update
	 * declared no guard of its own, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could rewrite a candidate's personal qualities (GHSA-v79w-54p2-wmh5). The base route still strips the
	 * members a body never writes.
	 *
	 * @param id The record to update.
	 * @param entity The columns to change.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns The store's update result, as the base route answers it.
	 */
	@ApiOperation({ summary: 'Update existing record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record updated successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided for update' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<CandidatePersonalQualities>,
		...options: any[]
	): Promise<any> {
		return await super.update(id, entity, ...options);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach its role guard. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states the roles `CANDIDATE`, `SUPER_ADMIN`, `ADMIN`: the role
	 * set every other route of this controller states (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<CandidatePersonalQualities> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach its role guard. The base
	 * declares the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so
	 * any member of the tenant could restore the row. It now states the roles `CANDIDATE`, `SUPER_ADMIN`, `ADMIN`:
	 * the role set every other route of this controller states (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<CandidatePersonalQualities> {
		return await super.softRecover(id, ...options);
	}
}
