import '../core/entities/internal';

import { EmployeeNotificationTypeEnum, IUser } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EmployeeNotificationService } from './employee-notification.service';

const ORGANIZATION_B = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a0b00';
const BEN = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00b1';
const CLEO = '0b6e2f8e-4c1a-4b8e-9a51-2f7c1d0a00c1';
const LINK = 'https://boards.example/#room=r00m,secret-key';

/**
 * A Board notification from the Boards app (ever-co/ever-teams#5022, review on ever-co/ever-gauzy#12007):
 * - it is filed in the organization `boardNotificationsOf` checked the caller works in, even when that is not the
 *   organization of their token (their last one): the organization boundary of the CRUD base would refuse it.
 */
describe('EmployeeNotificationService — notifyAboutBoard, in the organization the caller picked', () => {
	const fixture = createTenantFixture({
		user: { employeeId: 'employee-ana', firstName: 'Ana', lastName: 'Lima' } as IUser
	});
	const employees = [
		{ id: 'employee-ana', userId: fixture.user.id, organizationId: fixture.organizationId, isActive: true },
		{ id: 'employee-ana-b', userId: fixture.user.id, organizationId: ORGANIZATION_B, isActive: true },
		{ id: BEN, organizationId: ORGANIZATION_B, isActive: true },
		{ id: CLEO, organizationId: ORGANIZATION_B, isActive: true }
	];
	const input = { receiverEmployeeIds: [BEN, CLEO], roomId: 'r00m', boardName: 'Sprint plan', link: LINK };

	let restore: () => void;
	let cls: Map<string, unknown>;

	function serviceOn(connection: Record<string, unknown> = {}): EmployeeNotificationService {
		const repository = {
			find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
				where['userId']
					? employees.filter((employee) => employee.userId === where['userId'])
					: employees.filter(
							(employee) => !employee.userId && employee.organizationId === where['organizationId']
						)
			)
		};
		return new EmployeeNotificationService(
			{
				metadata: {
					tableName: 'employee_notification',
					hasColumnWithPropertyPath: (column: string) => column !== 'employeeId'
				},
				manager: { connection: { getRepository: jest.fn(() => repository), ...connection } }
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish: jest.fn() } as any
		);
	}

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		// The request-scoped store the organization boundary's escapes count their open blocks in
		cls = new Map();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(RequestContext as any).clsService = {
			get: (key: string) => cls.get(key),
			set: (key: string, value: unknown) => cls.set(key, value)
		};
	});

	afterEach(() => {
		restore?.();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (RequestContext as any).clsService;
		jest.restoreAllMocks();
	});

	it('files it through the real create path in another organization the caller works in, not their last one', async () => {
		const service = serviceOn();
		jest.spyOn(service.logger, 'warn').mockImplementation(() => undefined);
		jest.spyOn(service.logger, 'error').mockImplementation(() => undefined);
		const find = jest.spyOn(service, 'find').mockResolvedValue([]);
		// The persistence edge only: the tenant scoping and the organization boundary of the CRUD base run for real
		const inserted = jest
			.spyOn(CrudService.prototype, 'create')
			.mockImplementation(async (entity) => ({ id: `notification-${Math.random()}`, ...entity }) as never);

		await expect(
			service.notifyAboutBoard(EmployeeNotificationTypeEnum.BOARD_SHARE, {
				...input,
				organizationId: ORGANIZATION_B
			})
		).resolves.toEqual({ notified: 2 });

		expect(inserted.mock.calls.map(([entity]) => entity)).toEqual([
			expect.objectContaining({
				receiverEmployeeId: BEN,
				organizationId: ORGANIZATION_B,
				tenantId: fixture.tenantId
			}),
			expect.objectContaining({
				receiverEmployeeId: CLEO,
				organizationId: ORGANIZATION_B,
				tenantId: fixture.tenantId
			})
		]);
		// The unread check looks in that organization too
		expect(find).toHaveBeenCalledWith({
			where: expect.objectContaining({ organizationId: ORGANIZATION_B, sentByEmployeeId: 'employee-ana-b' })
		});
	});

});
