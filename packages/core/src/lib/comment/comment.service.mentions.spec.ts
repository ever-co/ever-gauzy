/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BaseEntityEnum, ICommentUpdateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { CommentService } from './comment.service';

/**
 * `CommentService.update` syncs the comment's mentions only when the caller sends `mentionEmployeeIds`. A resolve or
 * a reopen (the Documents comment thread sends only `resolved` and `resolvedAt`) used to sync an empty list and
 * delete every mention of the comment, so the next text edit notified everyone again.
 *
 * The mentions an edit adds belong to the comment's task or document. On TypeORM the save answers only the columns
 * it was given, so a parent read from the save result was empty and the mention was stored, subscribed and notified
 * against the comment itself.
 */
describe('CommentService.update — the mentions of the comment', () => {
	/** The comment as stored: posted on a task by the caller. */
	const STORED = {
		id: 'comment-1',
		entity: BaseEntityEnum.Task,
		entityId: 'task-1',
		employeeId: 'employee-me',
		organizationId: 'organization-1'
	};

	let service: CommentService;
	let updateEntityMentions: jest.Mock;

	beforeEach(() => {
		// The author, who may not act for other employees
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-me' as any);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);

		service = Object.create(CommentService.prototype);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).findOneByWhereOptions = jest.fn().mockResolvedValue({ ...STORED });
		updateEntityMentions = jest.fn().mockResolvedValue(undefined);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any)._mentionService = { updateEntityMentions };
		// What TypeORM's save answers: the columns it was given, without the comment's task or document
		jest.spyOn(TenantAwareCrudService.prototype, 'create')
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.mockImplementation(async (input) => ({ ...input }) as any);
	});

	afterEach(() => jest.restoreAllMocks());

	const update = (input: ICommentUpdateInput) => service.update('comment-1', input);

	it('leaves the mentions as they are when the update does not send the list (resolve, reopen)', async () => {
		await update({ resolved: true, resolvedAt: new Date() });
		await update({ resolved: false });

		expect(updateEntityMentions).not.toHaveBeenCalled();
	});

	it('removes every mention when the update sends an empty list', async () => {
		await update({ comment: 'No mention left', mentionEmployeeIds: [] });

		expect(updateEntityMentions).toHaveBeenCalledWith(
			BaseEntityEnum.Comment,
			'comment-1',
			[],
			'task-1',
			BaseEntityEnum.Task,
			'organization-1'
		);
	});

	it("attaches the mentions an edit adds to the comment's task, not to the comment", async () => {
		await update({ comment: 'Over to you @Ada', mentionEmployeeIds: ['employee-ada'] });

		expect(updateEntityMentions).toHaveBeenCalledWith(
			BaseEntityEnum.Comment,
			'comment-1',
			['employee-ada'],
			'task-1',
			BaseEntityEnum.Task,
			'organization-1'
		);
	});
});
