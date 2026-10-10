import { Controller, UseGuards, Post, Body, Delete, Param, Get, Put, Query, HttpStatus, HttpCode, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { RolesEnum, ICandidateTechnologies, IPagination, ID } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { RoleGuard, TenantPermissionGuard } from './../shared/guards';
import { Roles } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { CandidateTechnologiesService } from './candidate-technologies.service';
import { CandidateTechnologies } from './candidate-technologies.entity';
import {
	CandidateTechnologiesBulkCreateCommand,
	CandidateTechnologiesBulkDeleteCommand,
	CandidateTechnologiesBulkUpdateCommand
} from './commands';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('CandidateTechnology')
@UseGuards(TenantPermissionGuard)
@Controller('/candidate-technologies')
export class CandidateTechnologiesController extends CrudController<CandidateTechnologies> {
	constructor(
		private readonly candidateTechnologiesService: CandidateTechnologiesService,
		private readonly commandBus: CommandBus
	) {
		super(candidateTechnologiesService);
	}

	/**
	 * CREATE bulk candidate technologies
	 *
	 * @param body
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post('bulk')
	async createBulkCandidateTechnologies(@Body() body: any): Promise<ICandidateTechnologies[]> {
		const { interviewId = null, technologies = [] } = body;
		return await this.commandBus.execute(new CandidateTechnologiesBulkCreateCommand(interviewId, technologies));
	}

	/**
	 * UPDATE bulk candidate technologies
	 *
	 * @param body
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Put('bulk')
	async updateBulkCandidateTechnologies(@Body() body: ICandidateTechnologies[]): Promise<ICandidateTechnologies[]> {
		return await this.commandBus.execute(new CandidateTechnologiesBulkUpdateCommand(body));
	}

	/**
	 * GET candidate technology by feedback id
	 *
	 * @param interviewId
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Get('interview/:interviewId')
	async findByInterviewId(
		@Param('interviewId', UUIDValidationPipe) interviewId: string
	): Promise<ICandidateTechnologies[]> {
		return await this.candidateTechnologiesService.getTechnologiesByInterviewId(interviewId);
	}

	/**
	 * DELETE bulk candidate technology by id
	 *
	 * @param id
	 * @param data
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete('bulk/:id')
	async deleteBulkTechnologies(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { technologies = null } = data;
		return await this.commandBus.execute(new CandidateTechnologiesBulkDeleteCommand(id, technologies));
	}

	/**
	 * GET all candidate technologies
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all candidate technologies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate technologies',
		type: CandidateTechnologies
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Get()
	findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<ICandidateTechnologies>> {
		const { findInput, relations } = data;
		return this.candidateTechnologiesService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * CREATE candidate technologies
	 *
	 * @param body
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post()
	async create(@Body() body: CandidateTechnologies): Promise<ICandidateTechnologies> {
		return this.candidateTechnologiesService.create(body);
	}

	/**
	 * DELETE candidate technologies by id
	 *
	 * @param id
	 * @returns
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete(':id')
	delete(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.candidateTechnologiesService.delete(id);
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
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<CandidateTechnologies> {
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
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<CandidateTechnologies> {
		return await super.softRecover(id, ...options);
	}
}
