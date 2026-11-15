import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, IUser } from '@gauzy/contracts';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EmployeeNotificationService } from './employee-notification.service';

/**
 * Inviting teammates to a Board (ever-co/ever-teams#5022) files one `Invitation` per teammate, and none for a teammate
 * who still has the same invitation unread: opening Boards with the same people again, or retrying a request that
 * failed half-way, must not fill their Inbox.
 */
describe('EmployeeNotificationService — inviteToBoard', () => {
	const fixture = createTenantFixture({
		user: { employeeId: 'employee-ana', firstName: 'Ana', lastName: 'Lima' } as IUser
	});
	const team = { id: 'team-1', name: 'Design', organizationId: fixture.organizationId, tenantId: fixture.tenantId };
	const members = ['employee-ana', 'employee-1', 'employee-2'].map((employeeId) => ({
		employeeId,
		isActive: true,
		employee: { isActive: true, isArchived: false }
	}));
	const title = 'Ana Lima Invited you to a Board with the Team "Design"';

	let restore: () => void;
	let service: EmployeeNotificationService;
	let create: jest.SpyInstance;
	let find: jest.SpyInstance;

	beforeEach(() => {
		const dataSource = {
			getRepository: jest.fn((entity: { name: string }) =>
				entity.name === 'OrganizationTeam'
					? { findOne: jest.fn(async () => team) }
					: { find: jest.fn(async () => members) }
			)
		};
		service = new EmployeeNotificationService(
			{
				metadata: {
					tableName: 'employee_notification',
					hasColumnWithPropertyPath: (column: string) => column !== 'employeeId'
				},
				manager: { connection: dataSource }
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish: jest.fn() } as any
		);
		create = jest.spyOn(service, 'create').mockImplementation(async (input) => ({ ...input }) as never);
		find = jest.spyOn(service, 'find').mockResolvedValue([]);
		({ restore } = asTenantUser(fixture));
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	it('files one Invitation per picked teammate, as the caller', async () => {
		await expect(
			service.inviteToBoard({ organizationTeamId: 'team-1', receiverEmployeeIds: ['employee-1', 'employee-2'] })
		).resolves.toEqual({ invited: 2 });

		expect(create.mock.calls.map(([invitation]) => invitation)).toEqual([
			expect.objectContaining({
				type: EmployeeNotificationTypeEnum.INVITATION,
				entity: BaseEntityEnum.OrganizationTeam,
				entityId: 'team-1',
				title,
				receiverEmployeeId: 'employee-1',
				sentByEmployeeId: 'employee-ana'
			}),
			expect.objectContaining({ receiverEmployeeId: 'employee-2' })
		]);
	});

	it('does not file the invitation again for a teammate who still has it unread', async () => {
		find.mockResolvedValue([
			{ receiverEmployeeId: 'employee-1', title },
			// An invitation to join the team, from the same member: another notification
			{ receiverEmployeeId: 'employee-2', title: 'Ana Lima Invited you to join the OrganizationTeam "Design"' }
		]);

		await expect(
			service.inviteToBoard({ organizationTeamId: 'team-1', receiverEmployeeIds: ['employee-1', 'employee-2'] })
		).resolves.toEqual({ invited: 2 });

		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0]).toEqual(expect.objectContaining({ receiverEmployeeId: 'employee-2' }));
		// Only unread, unarchived invitations from the caller about the team are looked up
		expect(find).toHaveBeenCalledWith({
			where: expect.objectContaining({
				type: EmployeeNotificationTypeEnum.INVITATION,
				entity: BaseEntityEnum.OrganizationTeam,
				entityId: 'team-1',
				sentByEmployeeId: 'employee-ana',
				tenantId: fixture.tenantId,
				organizationId: fixture.organizationId,
				isRead: false,
				isArchived: false
			})
		});
	});

	it('files every invitation when the check fails', async () => {
		find.mockRejectedValue(new Error('connection lost'));

		await service.inviteToBoard({ organizationTeamId: 'team-1', receiverEmployeeIds: ['employee-1', 'employee-2'] });

		expect(create).toHaveBeenCalledTimes(2);
	});

	it('refuses a caller who has no employee record', async () => {
		restore();
		({ restore } = asTenantUser(createTenantFixture({ tenantId: fixture.tenantId })));

		await expect(
			service.inviteToBoard({ organizationTeamId: 'team-1', receiverEmployeeIds: ['employee-1'] })
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(create).not.toHaveBeenCalled();
	});
});
