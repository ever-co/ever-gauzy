import '../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { CommentService } from './comment.service';
import { CommentParentAccessService } from './parent-access';

/**
 * The comment service turned every failure into a 400, so a missing comment or a missing author employee
 * answered 400 instead of 404, through the real service methods (the handlers above them now keep it).
 */
describe('CommentService keeps the status of its client errors', () => {
	const as = (employeeId: string | null, canChangeSelectedEmployee = false) => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId as any);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', employeeId } as any);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) => canChangeSelectedEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
	};

	const serviceWith = (overrides: Record<string, unknown>) =>
		Object.assign(Object.create(CommentService.prototype), {
			_eventBus: { publish: jest.fn() },
			_mentionService: { publishMention: jest.fn(), updateEntityMentions: jest.fn() },
			_parentAccess: new CommentParentAccessService(),
			...overrides
		}) as CommentService;

	afterEach(() => jest.restoreAllMocks());

	it('answers 404 when the comment to update does not exist', async () => {
		as('employee-1');
		const service = serviceWith({
			findOneByWhereOptions: jest.fn().mockRejectedValue(new NotFoundException('The requested record was not found'))
		});

		await expect(service.update('comment-1', { comment: 'edited' } as any)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('still answers 403 for a caller with no employee identity', async () => {
		as(null);
		const service = serviceWith({ findOneByWhereOptions: jest.fn() });

		await expect(service.update('comment-1', { comment: 'edited' } as any)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('answers 404 when the author employee does not exist', async () => {
		as('employee-1');
		const service = serviceWith({ _employeeService: { findOneByIdString: jest.fn().mockResolvedValue(null) } });

		await expect(
			service.create({ comment: 'hello', entity: 'Task', entityId: 'task-1', organizationId: 'org-1' } as any)
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('still answers 400 for an unexpected failure', async () => {
		as('employee-1');
		const service = serviceWith({
			findOneByWhereOptions: jest.fn().mockRejectedValue(new Error('connection lost'))
		});

		await expect(service.update('comment-1', { comment: 'edited' } as any)).rejects.toBeInstanceOf(BadRequestException);
	});
});
