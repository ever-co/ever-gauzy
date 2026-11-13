/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BaseEntityEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { CommentEvent } from './events';
import { CommentService } from './comment.service';
import { CommentParentAccessService } from './parent-access';

/**
 * The edit marker and the reaction hint (comments-and-trash P4, P5).
 *
 * `editedAt` was a column a body could set to anything and the server never stamped, so no reader could trust an
 * "edited" marker. It is now the server's: an update that changes the text stamps it, and a body's value is ignored.
 * A change of a comment's reactions is announced as a change of the comment, which the real-time channel already
 * turns into a `comment.updated` hint for the record's readers.
 */
describe('CommentService — the edit marker and the reaction hint', () => {
	const TENANT = 'tenant-1';
	const ORGANIZATION = 'organization-1';
	const COMMENT = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

	let service: CommentService;
	let baseCreate: jest.SpyInstance;
	let publish: jest.Mock;

	const stored = {
		id: COMMENT,
		comment: 'Original text',
		entity: BaseEntityEnum.Task,
		entityId: 'task-1',
		parentId: null,
		employeeId: 'employee-me',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		editedAt: null
	};

	const as = (employeeId: string | null) => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId as never);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-me', employeeId } as never);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-me' as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT as never);
		// Not a CHANGE_SELECTED_EMPLOYEE holder: the author edits their own comment.
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
	};

	const written = () => baseCreate.mock.calls[0][0] as Record<string, unknown>;

	beforeEach(() => {
		service = Object.create(CommentService.prototype);
		publish = jest.fn();
		Object.assign(service, {
			_parentAccess: new CommentParentAccessService(),
			_employeeService: { findOneByIdString: jest.fn(async (id: string) => ({ id })) },
			_mentionService: { publishMention: jest.fn(), updateEntityMentions: jest.fn() },
			_eventBus: { publish },
			findOneByWhereOptions: jest.fn().mockResolvedValue({ ...stored })
		});
		baseCreate = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (input) => ({ ...input }) as never);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('update', () => {
		it('stamps editedAt when the text changes', async () => {
			as('employee-me');
			const before = Date.now();

			await service.update(COMMENT, { comment: 'Fixed a typo' } as never);

			expect(written().comment).toBe('Fixed a typo');
			expect(written().editedAt).toBeInstanceOf(Date);
			expect((written().editedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
		});

		it('ignores an editedAt the body states, with or without a text change', async () => {
			as('employee-me');
			const forged = new Date('2001-01-01T00:00:00Z');

			await service.update(COMMENT, { resolved: true, editedAt: forged } as never);
			expect(written()).not.toHaveProperty('editedAt');

			baseCreate.mockClear();
			await service.update(COMMENT, { comment: 'New text', editedAt: forged } as never);
			expect(written().editedAt).not.toEqual(forged);
			expect(written().editedAt).toBeInstanceOf(Date);
		});

		it('does not mark a comment edited for a resolve, a reopen, a mention change or the same text', async () => {
			as('employee-me');

			for (const change of [
				{ resolved: true, resolvedAt: new Date() },
				{ resolved: false, resolvedAt: null, resolvedByEmployeeId: null },
				{ mentionEmployeeIds: [] },
				{ comment: 'Original text' }
			]) {
				baseCreate.mockClear();
				await service.update(COMMENT, change as never);
				expect(written()).not.toHaveProperty('editedAt');
			}
		});
	});

	describe('create', () => {
		it('drops an editedAt the body states: a new comment was never edited', async () => {
			as('employee-me');

			await service.create({
				comment: 'First words',
				entity: BaseEntityEnum.Task,
				entityId: 'task-1',
				organizationId: ORGANIZATION,
				editedAt: new Date('2001-01-01T00:00:00Z')
			} as never);

			expect(written().comment).toBe('First words');
			expect(written()).not.toHaveProperty('editedAt');
		});
	});

	describe('announceReactionChange', () => {
		it('publishes comment.updated for the comment, with its record and no text', async () => {
			as('employee-me');
			(service as any).withoutEmployeeFilter = jest.fn(async (read: () => Promise<unknown>) => read());
			jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({ ...stored } as never);

			await service.announceReactionChange(COMMENT);

			expect(publish).toHaveBeenCalledTimes(1);
			const [event] = publish.mock.calls[0] as [CommentEvent];
			expect(event).toBeInstanceOf(CommentEvent);
			expect(event.type).toBe('updated');
			expect(event.comment).toEqual({
				id: COMMENT,
				entity: BaseEntityEnum.Task,
				entityId: 'task-1',
				parentId: null,
				tenantId: TENANT,
				organizationId: ORGANIZATION
			});
			expect(event.comment).not.toHaveProperty('comment');
			// Read across authors: a reaction on a colleague's comment is announced too.
			expect((service as any).withoutEmployeeFilter).toHaveBeenCalled();
		});

		it('publishes nothing for a comment that cannot be read, or an id that is not one', async () => {
			as('employee-me');
			(service as any).withoutEmployeeFilter = jest.fn(async (read: () => Promise<unknown>) => read());
			jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockRejectedValue(new Error('gone'));

			await service.announceReactionChange(COMMENT);
			await service.announceReactionChange('not-a-uuid');

			expect(publish).not.toHaveBeenCalled();
		});
	});
});
