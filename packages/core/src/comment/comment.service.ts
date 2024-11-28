import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsSelect, FindOptionsWhere, In, UpdateResult } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { BaseEntityEnum, IComment, ICommentCreateInput, ICommentUpdateInput, ID } from '@gauzy/contracts';
import { UserService } from '../user/user.service';
import { MentionService } from '../mention/mention.service';
import { Mention } from '../mention/mention.entity';
import { Comment } from './comment.entity';
import { TypeOrmCommentRepository } from './repository/type-orm.comment.repository';
import { MikroOrmCommentRepository } from './repository/mikro-orm-comment.repository';

@Injectable()
export class CommentService extends TenantAwareCrudService<Comment> {
	constructor(
		readonly typeOrmCommentRepository: TypeOrmCommentRepository,
		readonly mikroOrmCommentRepository: MikroOrmCommentRepository,
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
			const { mentionIds = [], ...data } = input;

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
				mentionIds.map((mentionedUserId) =>
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
			const { mentionIds } = input;

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

			// Where condition for searching mentions
			const where: FindOptionsWhere<Mention> = {
				entity: BaseEntityEnum.Comment,
				entityId: id
			};

			// Select option for selecting mentions' fields
			const select: FindOptionsSelect<Mention> = {
				mentionedUserId: true
			};

			const commentMentions = await this.mentionService.find({ where, select });

			// Extract existing mentioned users in comment
			const existingMentionUserIds = new Set(commentMentions.map((mention) => mention.mentionedUserId));

			const mentionsToAdd = mentionIds.filter((id) => !existingMentionUserIds.has(id));
			const mentionsToRemove = [...existingMentionUserIds].filter((id) => !mentionIds.includes(id));

			// Add mentions
			if (mentionsToAdd.length > 0) {
				await Promise.all(
					mentionsToAdd.map((mentionedUserId) =>
						this.mentionService.publishMention({
							entity: BaseEntityEnum.Comment,
							entityId: updatedComment.id,
							mentionedUserId,
							mentionById: userId,
							parentEntityId: updatedComment.entityId,
							parentEntityType: updatedComment.entity
						})
					)
				);
			}
			// Delete unused mentions
			if (mentionsToRemove.length > 0) {
				await this.mentionService.delete({ mentionedUserId: In(mentionsToRemove), ...where });
			}

			return updatedComment;
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException('Comment update failed', error);
		}
	}
}
