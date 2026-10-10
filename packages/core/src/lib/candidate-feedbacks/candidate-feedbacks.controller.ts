import { Controller, HttpStatus, Get, Query, UseGuards, Post, Body, Put, Param, Delete, HttpCode, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { PermissionsEnum, ICandidateFeedbackCreateInput, IPagination, ICandidateFeedback, ID } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { FeedbackDeleteCommand, FeedbackUpdateCommand } from './commands';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('CandidateFeedback')
@UseGuards(TenantPermissionGuard)
@Controller('/candidate-feedbacks')
export class CandidateFeedbacksController extends CrudController<CandidateFeedback> {
	constructor(
		private readonly candidateFeedbacksService: CandidateFeedbacksService,
		private readonly commandBus: CommandBus
	) {
		super(candidateFeedbacksService);
	}

	/**
	 * GET feedback by interview id
	 *
	 * @param interviewId
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find feedbacks By Interview Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate feedbacks',
		type: CandidateFeedback
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	// TO DO
	// @Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT) TO DO
	@Get('interview/:interviewId')
	async findByInterviewId(
		@Param('interviewId', UUIDValidationPipe) interviewId: string
	): Promise<CandidateFeedback[]> {
		return this.candidateFeedbacksService.getFeedbacksByInterviewId(interviewId);
	}

	/**
	 * DELETE feedback by interview id
	 *
	 * @param interviewId
	 * @param feedbackId
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Delete('interview/:interviewId/:feedbackId')
	async deleteFeedback(
		@Param('interviewId', UUIDValidationPipe) interviewId: string,
		@Param('feedbackId', UUIDValidationPipe) feedbackId: string
	): Promise<any> {
		return await this.commandBus.execute(new FeedbackDeleteCommand(feedbackId, interviewId));
	}

	/**
	 * GET candidate feedback count
	 *
	 * @param filter
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all candidate feedbacks counts in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidates feedback count'
	})
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<CandidateFeedback>): Promise<number> {
		return await this.candidateFeedbacksService.countBy(options);
	}

	/**
	 * GET candidate feedbacks by pagination
	 *
	 * @param filter
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all candidate feedbacks in the same tenant using pagination.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidates in the tenant',
		type: CandidateFeedback
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() filter: BaseQueryDTO<CandidateFeedback>): Promise<IPagination<ICandidateFeedback>> {
		return this.candidateFeedbacksService.paginate(filter);
	}

	/**
	 * GET all candidate feedbacks
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all candidate feedback.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate feedback',
		type: CandidateFeedback
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<ICandidateFeedback>> {
		const { relations = [], findInput = null } = data;
		return this.candidateFeedbacksService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * GET candidate feedback by id
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find candidate feedback by id'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate feedback',
		type: CandidateFeedback
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<ICandidateFeedback> {
		return this.candidateFeedbacksService.findOneByIdString(id);
	}

	/**
	 * CREATE candidate feedback
	 *
	 * @param body
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Post()
	async create(@Body() body: ICandidateFeedbackCreateInput): Promise<ICandidateFeedback> {
		return this.candidateFeedbacksService.create(body);
	}

	/**
	 * UPDATE candidate feedback by id
	 *
	 * @param id
	 * @param body
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: ICandidateFeedbackCreateInput
	): Promise<ICandidateFeedback> {
		return this.commandBus.execute(new FeedbackUpdateCommand(id, body));
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `ORG_CANDIDATES_FEEDBACK_EDIT`: the grant its create,
	 * update and delete-by-interview routes state (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states
	 * the same.
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
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<CandidateFeedback> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `ORG_CANDIDATES_FEEDBACK_EDIT`: the grant its create,
	 * update and delete-by-interview routes state (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states
	 * the same.
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
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<CandidateFeedback> {
		return await super.softRecover(id, ...options);
	}
}
