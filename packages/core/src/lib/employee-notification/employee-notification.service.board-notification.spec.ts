import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { EmployeeNotificationTypeEnum, IUser } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EmployeeNotificationService } from './employee-notification.service';

const BEN = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00b1';
const CLEO = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00c1';
const LINK = 'https://boards.example/#room=r00m,secret-key';

/**
 * A Board shared from the Boards app, or a mention in one (ever-co/ever-teams#5022), files one notification per
 * colleague, as the caller, in the tenant of their sign-in: the Boards app sends no tenant or organization header. A
 * colleague who still has the same notification unread is not given another one, so a mention made again and again,
 * or a retried request, leaves one entry. The link may carry the Board's encryption key: it is never logged.
 */
describe('EmployeeNotificationService — notifyAboutBoard', () => {
	const fixture = createTenantFixture({
		user: { employeeId: 'employee-ana', firstName: 'Ana', lastName: 'Lima' } as IUser
	});
	const employees = [
		{
			id: 'employee-ana',
			userId: fixture.user.id,
			organizationId: fixture.organizationId,
			isActive: true,
			isArchived: false
		},
		{ id: BEN, organizationId: fixture.organizationId, isActive: true, isArchived: false },
		{ id: CLEO, organizationId: fixture.organizationId, isActive: true, isArchived: false }
	];
	const input = { receiverEmployeeIds: [BEN, CLEO], roomId: 'r00m', boardName: 'Sprint plan', link: LINK };
	const board = { roomId: 'r00m', name: 'Sprint plan', link: LINK };

	let restore: () => void;
	let service: EmployeeNotificationService;
	let create: jest.SpyInstance;
	let find: jest.SpyInstance;

	beforeEach(() => {
		const repository = {
			find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
				where['userId']
					? employees.filter((employee) => employee.userId === where['userId'])
					: employees.filter((employee) => !employee.userId)
			)
		};
		service = new EmployeeNotificationService(
			{
				metadata: {
					tableName: 'employee_notification',
					hasColumnWithPropertyPath: (column: string) => column !== 'employeeId'
				},
				manager: { connection: { getRepository: jest.fn(() => repository) } }
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish: jest.fn() } as any
		);
		create = jest
			.spyOn(service, 'create')
			.mockImplementation(async (notification) => ({ ...notification }) as never);
		find = jest.spyOn(service, 'find').mockResolvedValue([]);
		({ restore } = asTenantUser(fixture));
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	it('files one BoardShare per colleague, as the caller, in the tenant and organization of their sign-in', async () => {
		await expect(service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, input)).resolves.toEqual({
			notified: 2
		});

		expect(create.mock.calls.map(([notification]) => notification)).toEqual([
			{
				type: EmployeeNotificationTypeEnum.BOARD_SHARE,
				title: 'Ana Lima shared the Board "Sprint plan" with you',
				entity: null,
				entityId: null,
				metadata: { board },
				receiverEmployeeId: BEN,
				sentByEmployeeId: 'employee-ana',
				organizationId: fixture.organizationId,
				tenantId: fixture.tenantId
			},
			expect.objectContaining({ receiverEmployeeId: CLEO })
		]);
	});

	it('files a BoardMention for a mention', async () => {
		await service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_MENTION, {
			...input,
			receiverEmployeeIds: [BEN]
		});

		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				type: EmployeeNotificationTypeEnum.BOARD_MENTION,
				title: 'Ana Lima mentioned you in the Board "Sprint plan"',
				receiverEmployeeId: BEN
			})
		);
	});

	it('does not file it again for a colleague who still has it unread, about the same Board at the same link', async () => {
		find.mockResolvedValue([
			{ receiverEmployeeId: BEN, metadata: { board: { ...board, name: 'Renamed since' } } },
			// The same Board at another link (sent without its key, then with it): news
			{ receiverEmployeeId: CLEO, metadata: { board: { ...board, link: 'https://boards.example/' } } }
		]);

		await expect(service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, input)).resolves.toEqual({
			notified: 2
		});

		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0]).toEqual(expect.objectContaining({ receiverEmployeeId: CLEO }));
		// Only the unread, unarchived notifications of the kind from the caller are looked up
		expect(find).toHaveBeenCalledWith({
			where: expect.objectContaining({
				type: EmployeeNotificationTypeEnum.BOARD_SHARE,
				sentByEmployeeId: 'employee-ana',
				tenantId: fixture.tenantId,
				organizationId: fixture.organizationId,
				isRead: false,
				isArchived: false
			})
		});
	});

	it('files every notification when the check fails, and logs no link', async () => {
		const warn = jest.spyOn(service.logger, 'warn').mockImplementation(() => undefined);
		find.mockRejectedValue(Object.assign(new Error('connection lost'), { query: 'SELECT …', parameters: [LINK] }));

		await service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, input);

		expect(create).toHaveBeenCalledTimes(2);
		expect(warn).toHaveBeenCalled();
		expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-key');
	});

	it('files nothing for a caller who named only themselves', async () => {
		await expect(
			service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, {
				...input,
				receiverEmployeeIds: ['employee-ana']
			})
		).resolves.toEqual({ notified: 0 });
		expect(create).not.toHaveBeenCalled();
		expect(find).not.toHaveBeenCalled();
	});

	it('refuses a request without a signed-in user', async () => {
		restore();
		const spy = jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);
		restore = () => spy.mockRestore();

		await expect(service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, input)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(create).not.toHaveBeenCalled();
	});

	it('refuses a third-party app whose approved scopes do not write, and serves one whose scopes do', async () => {
		restore();
		({ restore } = asTenantUser({
			...fixture,
			user: { ...fixture.user, oauthApp: { clientId: 'app', scopes: ['zap'] } } as IUser
		}));
		await expect(service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, input)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(create).not.toHaveBeenCalled();

		restore();
		({ restore } = asTenantUser({
			...fixture,
			user: { ...fixture.user, oauthApp: { clientId: 'app', scopes: ['zap:write'] } } as IUser
		}));
		await expect(service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, input)).resolves.toEqual({
			notified: 2
		});
	});
});
