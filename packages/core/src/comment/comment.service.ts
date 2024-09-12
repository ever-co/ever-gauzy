import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { IComment, ICommentCreateInput, ICommentUpdateInput, ID } from '@gauzy/contracts';
import { EmployeeService } from '../employee/employee.service';
import { Comment } from './comment.entity';
import { TypeOrmCommentRepository } from './repository/type-orm.comment.repository';
import { MikroOrmCommentRepository } from './repository/mikro-orm-comment.repository';

@Injectable()
export class CommentService extends TenantAwareCrudService<Comment> {
	constructor(
		readonly typeOrmCommentRepository: TypeOrmCommentRepository,
		readonly mikroOrmCommentRepository: MikroOrmCommentRepository,
		private readonly employeeService: EmployeeService
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
			const tenantId = RequestContext.currentTenantId();
			const { creatorId, ...entity } = input;

			// Employee existence validation
			const employee = await this.employeeService.findOneByIdString(creatorId);
			if (!employee) {
				throw new NotFoundException('Employee not found');
			}

			// return created comment
			return await this.save({
				...entity,
				tenantId,
				creatorId: employee.id
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
			const employeeId = RequestContext.currentEmployeeId();
			const comment = await this.findOneByOptions({
				where: {
					id,
					creatorId: employeeId
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
