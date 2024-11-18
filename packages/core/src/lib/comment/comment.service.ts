import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { IComment, ICommentCreateInput, ICommentUpdateInput, ID } from '@gauzy/contracts';
import { UserService } from '../user/user.service';
import { Comment } from './comment.entity';
import { TypeOrmCommentRepository } from './repository/type-orm.comment.repository';
import { MikroOrmCommentRepository } from './repository/mikro-orm-comment.repository';

@Injectable()
export class CommentService extends TenantAwareCrudService<Comment> {
	constructor(
		readonly typeOrmCommentRepository: TypeOrmCommentRepository,
		readonly mikroOrmCommentRepository: MikroOrmCommentRepository,
		private readonly userService: UserService
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
			const { ...entity } = input;

			// Employee existence validation
			const user = await this.userService.findOneByIdString(userId);
			if (!user) {
				throw new NotFoundException('User not found');
			}

			// return created comment
			return await super.create({
				...entity,
				tenantId,
				creatorId: user.id
			});
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException('Comment post failed', error);
		}
	}

	/**
	 * @description Update comment - Note
	 * @param {ICommentUpdateInput} input - Data to update comment
	 * @returns A promise that resolves to the updated comment OR Update result
	 * @memberof CommentService
	 */
	async update(id: ID, input: ICommentUpdateInput): Promise<IComment | UpdateResult> {
		try {
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

			return await super.create({
				...input,
				id
			});
		} catch (error) {
			console.log(error); // Debug Logging
			throw new BadRequestException('Comment update failed', error);
		}
	}
}
