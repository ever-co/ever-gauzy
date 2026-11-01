/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BaseEntityEnum, ICommentCreateInput, PermissionsEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { CommentService } from './comment.service';
import { CommentParentAccessService } from './parent-access';

/**
 * Who wrote a comment is the caller, never the body (privilege-escalation audit 2026-10-24, F8).
 *
 * `CommentService.create` resolved the author as `currentEmployeeId() ?? currentUser().employeeId ?? input.employeeId`.
 * So a caller with no employee record (typically a VIEWER, CANDIDATE or INTERVIEWER account) could post as any
 * employee, and the mention notifications went out in that employee's name. `CreateCommentDTO` extends the
 * entity, so `resolvedByEmployeeId` survived the whitelist too, and an edit by a CHANGE_SELECTED_EMPLOYEE holder
 * wrote a body `employeeId` over the stored author.
 */
describe('CommentService — the author and the resolver are the caller', () => {
	const TENANT = 'tenant-1';
	const ORGANIZATION = 'organization-1';
	const VICTIM = 'employee-victim';

	let service: CommentService;
	let baseCreate: jest.SpyInstance;
	let findEmployee: jest.Mock;
	let publish: jest.Mock;

	/**
	 * Who is calling: their own employee (or none), their user, whether they may act for others, and whether they
	 * administer the tenant (`SUPER_ADMIN` / `ADMIN`, read by `isCallerTenantAdmin`).
	 */
	const as = (employeeId: string | null, canChangeSelectedEmployee = false, tenantAdmin = false) => {
		// currentEmployeeId() is null for a CHANGE_SELECTED_EMPLOYEE holder, whatever their user carries.
		jest
			.spyOn(RequestContext, 'currentEmployeeId')
			.mockReturnValue((canChangeSelectedEmployee ? null : employeeId) as never);
		jest
			.spyOn(RequestContext, 'currentUser')
			.mockReturnValue({ id: 'user-me', ...(employeeId ? { employeeId } : {}) } as never);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-me' as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT as never);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) =>
				canChangeSelectedEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(tenantAdmin);
	};

	/** What a forger posts: a colleague as the author and as the resolver. */
	const forged = (): ICommentCreateInput =>
		({
			comment: 'Approved, pay it out',
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			organizationId: ORGANIZATION,
			employeeId: VICTIM,
			resolvedByEmployeeId: VICTIM,
			mentionEmployeeIds: []
		}) as ICommentCreateInput;

	const written = () => baseCreate.mock.calls[0][0] as Record<string, unknown>;

	beforeEach(() => {
		service = Object.create(CommentService.prototype);
		(service as any)._parentAccess = new CommentParentAccessService();
		findEmployee = jest.fn(async (id: string) => ({ id }));
		publish = jest.fn();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any)._employeeService = { findOneByIdString: findEmployee };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any)._mentionService = { publishMention: jest.fn(), updateEntityMentions: jest.fn() };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any)._eventBus = { publish };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).findOneByWhereOptions = jest.fn().mockResolvedValue({
			id: 'comment-1',
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			employeeId: 'employee-me',
			organizationId: ORGANIZATION
		});
		baseCreate = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (input) => ({ id: 'comment-1', ...input }) as never);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('create', () => {
		it("records the caller's own employee as the author, whatever the body names", async () => {
			as('employee-me');

			await service.create(forged());

			expect(written().employeeId).toBe('employee-me');
			expect(findEmployee).toHaveBeenCalledWith('employee-me');
			expect(findEmployee).not.toHaveBeenCalledWith(VICTIM);
		});

		it('posts an author-less comment for a caller with no employee record, instead of the body author', async () => {
			as(null);

			await service.create(forged());

			// No author: the comment is the posting user's, by the createdByUserId the subscriber stamps.
			expect(written().employeeId).toBeUndefined();
			expect(findEmployee).not.toHaveBeenCalled();
			// The subscription event names no one else either.
			expect(publish.mock.calls[0][0].input.employeeId).toBeUndefined();
		});

		it("records a CHANGE_SELECTED_EMPLOYEE holder's own employee, read off the JWT user", async () => {
			as('employee-admin', true);

			await service.create(forged());

			expect(written().employeeId).toBe('employee-admin');
		});

		it('does not let a tenant administrator with no employee record post as someone else', async () => {
			as(null, true, true);

			await service.create(forged());

			expect(written().employeeId).toBeUndefined();
		});

		it('never takes a resolver or a relation object from the body', async () => {
			as('employee-me');

			await service.create({
				...forged(),
				employee: { id: VICTIM },
				resolvedByEmployee: { id: VICTIM },
				createdByUserId: 'user-other'
			} as never);

			expect(written()).not.toHaveProperty('createdByUserId');
			expect(written()).not.toHaveProperty('resolvedByEmployeeId');
			expect(written()).not.toHaveProperty('resolvedByEmployee');
			expect(written()).not.toHaveProperty('employee');
		});
	});

	describe('update', () => {
		it('keeps the stored author and records the caller as the resolver the body names', async () => {
			as('employee-me');

			await service.update('comment-1', {
				resolved: true,
				employeeId: VICTIM,
				resolvedByEmployeeId: VICTIM
			} as never);

			expect(written()).not.toHaveProperty('employeeId', VICTIM);
			expect(written().resolvedByEmployeeId).toBe('employee-me');
			expect(written().id).toBe('comment-1');
		});

		it('does not let a CHANGE_SELECTED_EMPLOYEE holder who is not a tenant administrator re-author a comment', async () => {
			as('employee-manager', true);

			await service.update('comment-1', {
				comment: 'Edited',
				employeeId: VICTIM,
				resolvedByEmployeeId: VICTIM
			} as never);

			expect(written()).not.toHaveProperty('employeeId');
			expect(written().resolvedByEmployeeId).toBe('employee-manager');
		});

		it('keeps what a tenant administrator states on an edit, as every per-user row does (ever-co/ever-gauzy#11328)', async () => {
			as('employee-admin', true, true);

			await service.update('comment-1', { employeeId: VICTIM, resolvedByEmployeeId: VICTIM } as never);

			expect(written().employeeId).toBe(VICTIM);
			expect(written().resolvedByEmployeeId).toBe(VICTIM);
		});

		it('never writes the posting user from an edit, whoever edits', async () => {
			as('employee-admin', true, true);

			await service.update('comment-1', {
				comment: 'Edited',
				createdByUserId: 'user-other',
				createdByUser: { id: 'user-other' }
			} as never);

			expect(written()).not.toHaveProperty('createdByUserId');
			expect(written()).not.toHaveProperty('createdByUser');
		});

		it('clears the resolver on an explicit null (a reopen)', async () => {
			as('employee-me');

			await service.update('comment-1', { resolved: false, resolvedByEmployeeId: null } as never);

			expect(written().resolvedByEmployeeId).toBeNull();
		});

		it('leaves the resolver alone when the edit does not name one (the Documents resolve flow)', async () => {
			as('employee-me');

			await service.update('comment-1', { resolved: true, resolvedAt: new Date() });

			expect(written()).not.toHaveProperty('resolvedByEmployeeId');
		});
	});
});
