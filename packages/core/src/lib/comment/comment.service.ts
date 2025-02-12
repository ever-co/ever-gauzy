import { EventBus } from '@nestjs/cqrs';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import {
	BaseEntityEnum,
	IComment,
	ICommentCreateInput,
	ICommentUpdateInput,
	ID,
	SubscriptionTypeEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { CreateSubscriptionEvent } from '../subscription/events';
import { EmployeeService } from '../employee/employee.service';
import { MentionService } from '../mention/mention.service';
import { Comment } from './comment.entity';
import { TypeOrmCommentRepository } from './repository/type-orm.comment.repository';
import { MikroOrmCommentRepository } from './repository/mikro-orm-comment.repository';

@Injectable()
export class CommentService extends TenantAwareCrudService<Comment> {
	constructor(
		readonly typeOrmCommentRepository: TypeOrmCommentRepository,
		readonly mikroOrmCommentRepository: MikroOrmCommentRepository,
		private readonly _eventBus: EventBus,
		private readonly _employeeService: EmployeeService,
		private readonly _mentionService: MentionService
	) {
		super(typeOrmCommentRepository, mikroOrmCommentRepository);
	}

	/**
	 * Creates a new comment and handles related actions such as publishing mentions
	 * and subscribing the creator to the comment's entity.
	 *
	 * This function retrieves the current user, employee, and tenant IDs from the RequestContext.
	 * It validates that the user exists, creates a comment record, publishes any provided mentions,
	 * and then publishes a subscription event for the creator. If any step fails, a BadRequestException
	 * is thrown.
	 *
	 * @param {ICommentCreateInput} input - The data required to create a comment.
	 * @returns {Promise<IComment>} A promise that resolves to the newly created comment.
	 * @throws {NotFoundException} If the current user is not found.
	 * @throws {BadRequestException} If the comment creation or related processes fail.
	 */
	async create(input: ICommentCreateInput): Promise<IComment> {
		try {
			// Retrieve context-specific IDs.
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			const employeeId = RequestContext.currentEmployeeId() ?? input.employeeId;
			const { mentionEmployeeIds = [], organizationId, ...data } = input;

			// Validate that the user exists.
			const employee = await this._employeeService.findOneByIdString(employeeId);
			if (!employee) {
				throw new NotFoundException(`Employee with id ${employeeId} not found`);
			}

			// Create the comment.
			const comment = await super.create({
				...data,
				employeeId,
				tenantId,
				organizationId
			});

			// Publish mentions for each mentioned employee, if any.
			await Promise.all(
				mentionEmployeeIds.map((mentionedUserId) =>
					this._mentionService.publishMention({
						entity: BaseEntityEnum.Comment,
						entityId: comment.id,
						entityName: input.entityName,
						mentionedUserId,
						mentionById: employee.id,
						parentEntityId: comment.entityId,
						parentEntityType: comment.entity,
						organizationId: comment.organizationId,
						tenantId: comment.tenantId
					})
				)
			);

			// Subscribe the comment creator to the entity.
			this._eventBus.publish(
				new CreateSubscriptionEvent({
					entity: input.entity,
					entityId: input.entityId,
					type: SubscriptionTypeEnum.COMMENT,
					organizationId: comment.organizationId,
					tenantId: comment.tenantId
				})
			);

			// Return the newly created comment.
			return comment;
		} catch (error) {
			console.log(`Error while creating comment: ${error.message}`, error);
			throw new BadRequestException('Comment post failed', error);
		}
	}

	/**
	 * Updates an existing comment based on the provided id and update input.
	 *
	 * This function first retrieves the current employee's ID from the request context,
	 * then attempts to locate the comment matching the provided id and employeeId.
	 * If the comment is found, it creates an updated version of the comment using the input data.
	 * Additionally, it synchronizes any mention updates via the _mentionService.
	 *
	 * @param {ID} id - The unique identifier of the comment to update.
	 * @param {ICommentUpdateInput} input - The update data for the comment, including any mention updates.
	 * @returns {Promise<IComment | UpdateResult>} A promise that resolves to the updated comment or an update result.
	 * @throws {BadRequestException} If the comment is not found or if the update operation fails.
	 */
	async update(id: ID, input: ICommentUpdateInput): Promise<IComment | UpdateResult> {
		try {
			const employeeId = RequestContext.currentEmployeeId();
			const { mentionEmployeeIds = [] } = input;

			// Find the comment for the current employee with the given id.
			const comment = await this.findOneByWhereOptions({
				id,
				employeeId
			});

			if (!comment) {
				throw new BadRequestException(`Comment with id ${id} not found`);
			}

			// Update the comment with the new input data.
			const updatedComment = await super.create({
				...input,
				id
			});

			// Synchronize any mention updates for the comment.
			await this._mentionService.updateEntityMentions(
				BaseEntityEnum.Comment,
				id,
				mentionEmployeeIds,
				updatedComment.entityId,
				updatedComment.entity
			);

			return updatedComment;
		} catch (error) {
			console.log(`Error while updating comment: ${error.message}`, error);
			throw new BadRequestException('Comment update failed', error);
		}
	}
}
