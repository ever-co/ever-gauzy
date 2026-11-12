/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { BaseEntityEnum, ReactionEntityEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { ReactionService } from './reaction.service';

/**
 * Reactions on comments (comments-and-trash P2-P4):
 *
 * - `GET /reaction/comments` summarizes everyone's reactions on the comments the caller can list, which the generic
 *   list could not (it keeps a caller without CHANGE_SELECTED_EMPLOYEE to their own reactions);
 * - `POST /reaction` on a comment reads the comment as the caller first;
 * - a comment's reaction changing is announced as a change of that comment, for the real-time hint.
 */
describe('ReactionService — reactions on comments', () => {
	const TENANT = 'tenant-1';
	const ORGANIZATION = 'organization-1';
	const TASK = '5a0f7b3c-2d1e-4f6a-9b8c-7d6e5f4a3b2c';
	const COMMENT_1 = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
	const COMMENT_2 = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f60';

	let service: ReactionService;
	let comments: {
		find: jest.Mock;
		findReadableById: jest.Mock;
		announceReactionChange: jest.Mock;
	};
	let baseFind: jest.SpyInstance;
	let baseCreate: jest.SpyInstance;
	let baseDelete: jest.SpyInstance;

	const as = (employeeId: string | null) => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId as never);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-me', employeeId } as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT as never);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
	};

	beforeEach(() => {
		service = Object.create(ReactionService.prototype);
		comments = {
			find: jest.fn().mockResolvedValue([{ id: COMMENT_1 }, { id: COMMENT_2 }]),
			findReadableById: jest.fn().mockResolvedValue({ id: COMMENT_1 }),
			announceReactionChange: jest.fn().mockResolvedValue(undefined)
		};
		Object.assign(service, {
			_commentService: comments,
			_employeeService: { findOneByIdString: jest.fn(async (id: string) => ({ id })) },
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			withoutEmployeeFilter: jest.fn(async (read: () => Promise<any>) => read())
		});
		baseFind = jest.spyOn(TenantAwareCrudService.prototype, 'find').mockResolvedValue([
			{
				id: 'r1',
				entity: ReactionEntityEnum.Comment,
				entityId: COMMENT_1,
				emoji: '👍',
				employeeId: 'employee-other',
				employee: { id: 'employee-other', user: { firstName: 'Bo', lastName: 'Ray' } },
				createdAt: '2026-11-11T10:00:00Z'
			},
			{
				id: 'r2',
				entity: ReactionEntityEnum.Comment,
				entityId: COMMENT_1,
				emoji: '👍',
				employeeId: 'employee-me',
				employee: { id: 'employee-me', user: { firstName: 'Me', lastName: 'Self' } },
				createdAt: '2026-11-11T10:01:00Z'
			}
		] as never);
		baseCreate = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (entity: object) => ({ id: 'reaction-new', ...entity }) as never);
		baseDelete = jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });
	});

	afterEach(() => jest.restoreAllMocks());

	describe('summarizeCommentReactions (GET /reaction/comments)', () => {
		it('reads the comments as the comment list does, then everyone’s reactions on them', async () => {
			as('employee-me');

			const summary = await service.summarizeCommentReactions({
				entity: BaseEntityEnum.Task,
				entityId: TASK,
				organizationId: ORGANIZATION
			});

			expect(comments.find).toHaveBeenCalledWith({
				where: { entity: BaseEntityEnum.Task, entityId: TASK, organizationId: ORGANIZATION },
				order: { createdAt: 'ASC' }
			});
			// Across reactors: the employee filter is lifted for the reaction read only.
			expect((service as any).withoutEmployeeFilter).toHaveBeenCalledTimes(1);
			expect(baseFind).toHaveBeenCalledWith({
				where: { entity: ReactionEntityEnum.Comment, entityId: In([COMMENT_1, COMMENT_2]) },
				relations: { employee: { user: true } }
			});
			expect(summary).toEqual([
				{
					entity: ReactionEntityEnum.Comment,
					entityId: COMMENT_1,
					emoji: '👍',
					count: 2,
					reactedByMe: true,
					reactionId: 'r2',
					reactors: [
						{ employeeId: 'employee-other', name: 'Bo Ray', imageUrl: null },
						{ employeeId: 'employee-me', name: 'Me Self', imageUrl: null }
					]
				}
			]);
		});

		it('reads no reaction when the caller can list no comment of the record', async () => {
			as('employee-me');
			comments.find.mockResolvedValue([]);

			await expect(
				service.summarizeCommentReactions({ entity: BaseEntityEnum.Task, entityId: TASK, organizationId: ORGANIZATION })
			).resolves.toEqual([]);
			expect(baseFind).not.toHaveBeenCalled();
		});

		it('lets a refused comment read through (a governed record the caller may not read)', async () => {
			as('employee-me');
			const refused = new NotFoundException('The requested record was not found');
			comments.find.mockRejectedValue(refused);

			await expect(
				service.summarizeCommentReactions({
					entity: BaseEntityEnum.OrganizationContact,
					entityId: TASK,
					organizationId: ORGANIZATION
				})
			).rejects.toBe(refused);
			expect(baseFind).not.toHaveBeenCalled();
		});

		it('reads the reactions of many comments in chunks', async () => {
			as('employee-me');
			const many = Array.from({ length: 1201 }, (_, index) => ({ id: `comment-${index}` }));
			comments.find.mockResolvedValue(many);
			baseFind.mockResolvedValue([]);

			await service.summarizeCommentReactions({ entity: BaseEntityEnum.Task, entityId: TASK, organizationId: ORGANIZATION });

			expect(baseFind).toHaveBeenCalledTimes(3);
		});
	});

	describe('create (POST /reaction) on a comment', () => {
		const input = {
			entity: ReactionEntityEnum.Comment,
			entityId: COMMENT_1,
			emoji: '👍',
			organizationId: ORGANIZATION
		};

		it('reads the comment as the caller before writing, and announces the change of the comment', async () => {
			as('employee-me');
			jest.spyOn(service, 'findOneOrFailByWhereOptions').mockResolvedValue({
				success: false,
				error: new NotFoundException()
			} as never);

			await expect(service.create(input as never)).resolves.toMatchObject({ id: 'reaction-new', emoji: '👍' });
			expect(comments.findReadableById).toHaveBeenCalledWith(COMMENT_1);
			expect(baseCreate).toHaveBeenCalled();
			expect(comments.announceReactionChange).toHaveBeenCalledWith(COMMENT_1);
		});

		it('writes nothing on a comment the caller cannot read, and answers its 404', async () => {
			as('employee-me');
			const unreadable = new NotFoundException('The requested record was not found');
			comments.findReadableById.mockRejectedValue(unreadable);

			await expect(service.create(input as never)).rejects.toBe(unreadable);
			expect(baseCreate).not.toHaveBeenCalled();
			expect(baseDelete).not.toHaveBeenCalled();
			expect(comments.announceReactionChange).not.toHaveBeenCalled();
		});

		it('announces a toggle-off too', async () => {
			as('employee-me');
			jest.spyOn(service, 'findOneOrFailByWhereOptions').mockResolvedValue({
				success: true,
				record: { id: 'r2' }
			} as never);

			await expect(service.create(input as never)).resolves.toBeUndefined();
			expect(baseDelete).toHaveBeenCalled();
			expect(comments.announceReactionChange).toHaveBeenCalledWith(COMMENT_1);
		});

		it('keeps the reaction when the announcement fails', async () => {
			as('employee-me');
			jest.spyOn(service, 'findOneOrFailByWhereOptions').mockResolvedValue({
				success: false,
				error: new NotFoundException()
			} as never);
			comments.announceReactionChange.mockRejectedValue(new Error('bus down'));
			jest.spyOn(console, 'warn').mockImplementation(() => undefined);

			await expect(service.create(input as never)).resolves.toMatchObject({ id: 'reaction-new' });
		});

		it('neither reads a comment nor announces anything for a task’s reaction', async () => {
			as('employee-me');
			jest.spyOn(service, 'findOneOrFailByWhereOptions').mockResolvedValue({
				success: false,
				error: new NotFoundException()
			} as never);

			await service.create({ ...input, entity: ReactionEntityEnum.Task, entityId: TASK } as never);
			expect(comments.findReadableById).not.toHaveBeenCalled();
			expect(comments.announceReactionChange).not.toHaveBeenCalled();
		});

		it('still refuses a chat message’s reaction before anything else', async () => {
			as('employee-me');

			await expect(
				service.create({ ...input, entity: ReactionEntityEnum.ChatMessage } as never)
			).rejects.toBeInstanceOf(BadRequestException);
			expect(comments.findReadableById).not.toHaveBeenCalled();
		});
	});

	describe('delete, withdraw and restore a comment’s reaction', () => {
		it('announces the comment that lost a deleted reaction', async () => {
			as('employee-me');
			jest.spyOn(service, 'findOneOrFailByWhereOptions').mockResolvedValue({
				success: true,
				record: { id: 'r2', entity: ReactionEntityEnum.Comment, entityId: COMMENT_1 }
			} as never);

			await expect(service.delete('r2')).resolves.toEqual({ affected: 1, raw: [] });
			expect(comments.announceReactionChange).toHaveBeenCalledWith(COMMENT_1);
		});

		it('announces nothing when the delete removed nothing, or the reaction is not a comment’s', async () => {
			as('employee-me');
			const lookup = jest.spyOn(service, 'findOneOrFailByWhereOptions').mockResolvedValue({
				success: true,
				record: { id: 'r2', entity: ReactionEntityEnum.Comment, entityId: COMMENT_1 }
			} as never);
			baseDelete.mockResolvedValue({ affected: 0, raw: [] });
			await service.delete('r2');

			lookup.mockResolvedValue({ success: false, error: new NotFoundException() } as never);
			baseDelete.mockResolvedValue({ affected: 1, raw: [] });
			await service.delete('r-task');

			expect(comments.announceReactionChange).not.toHaveBeenCalled();
		});

		it('announces a withdrawn and a restored reaction’s comment', async () => {
			as('employee-me');
			(service as any).findOneByIdString = jest.fn().mockResolvedValue({ id: 'r2' });
			const row = { id: 'r2', entity: ReactionEntityEnum.Comment, entityId: COMMENT_1 };
			jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue(row as never);
			jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue(row as never);

			await service.softRemove('r2');
			await service.softRecover('r2');

			expect(comments.announceReactionChange).toHaveBeenCalledTimes(2);
			expect(comments.announceReactionChange).toHaveBeenCalledWith(COMMENT_1);
		});
	});
});
