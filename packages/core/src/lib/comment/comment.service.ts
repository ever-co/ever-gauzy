import { EventBus } from '@nestjs/cqrs';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import {
	BaseEntityEnum,
	IComment,
	ICommentCreateInput,
	ICommentUpdateInput,
	ID,
	SubscriptionTypeEnum
} from '@gauzy/contracts';
import { CreateSubscriptionEvent } from '../subscription/events';
import { UserService } from '../user/user.service';
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
		private readonly userService: UserService,
		private readonly mentionService: MentionService
	) {
		super(typeOrmCommentRepository, mikroOrmCommentRepository);
	}

	/**
	 * @description Create / Post comment - Note
	 * @param {ICommentCreateInput} input - Data to creating comment
	 * @returns A promise that resolves to the created comment
	 * @memberof CommentService
	 */
	async create(input: ICommentCreateInput): Promise<IComment> {
		try {
			const userId = RequestContext.currentUserId();
			const tenantId = RequestContext.currentTenantId();
			const { mentionUserIds = [], ...data } = input;

			// Employee existence validation
			const user = await this.userService.findOneByIdString(userId);
			if (!user) {
				throw new NotFoundException('User not found');
			}

			// create comment
			const comment = await super.create({
				...data,
				tenantId,
				creatorId: user.id
			});

			// Apply mentions if needed
			await Promise.all(
				mentionUserIds.map((mentionedUserId) =>
					this.mentionService.publishMention({
						entity: BaseEntityEnum.Comment,
						entityId: comment.id,
						mentionedUserId,
						mentionById: user.id,
						parentEntityId: comment.entityId,
						parentEntityType: comment.entity
					})
				)
			);

			// Subscribe creator to the entity
			this._eventBus.publish(
				new CreateSubscriptionEvent({
					entity: input.entity,
					entityId: input.entityId,
					userId: user.id,
					type: SubscriptionTypeEnum.COMMENT,
					organizationId: comment.organizationId,
					tenantId
				})
			);

			// Return created Comment
			return comment;
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException('Comment post failed', error);
		}
	}

	/**
	 * @description Update comment - Note
	 * @param id - The comment ID to be updated.
	 * @param {ICommentUpdateInput} input - Data to update comment.
	 * @returns A promise that resolves to the updated comment OR Update result.
	 * @memberof CommentService
	 */
	async update(id: ID, input: ICommentUpdateInput): Promise<IComment | UpdateResult> {
		try {
			const { mentionUserIds = [] } = input;

			const userId = RequestContext.currentUserId();
			const comment = await this.findOneByOptions({
				where: {
					id,
					creatorId: userId
				}
			});

			if (!comment) {
				throw new BadRequestException('Comment not found');
			}

			const updatedComment = await super.create({
				...input,
				id
			});

			// Synchronize mentions
			await this.mentionService.updateEntityMentions(
				BaseEntityEnum.Comment,
				id,
				mentionUserIds,
				updatedComment.entityId,
				updatedComment.entity
			);

			return updatedComment;
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException('Comment update failed', error);
		}
	}
}
