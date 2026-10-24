import '../core/entities/internal';

import { In } from 'typeorm';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { AppointmentEmployeesService } from '../appointment-employees/appointment-employees.service';
import { EmployeeAppointmentService } from './employee-appointment.service';

/**
 * An appointment, and an invitation to one, is its employee's: their calendar, the agenda, the location and the
 * invitees' emails. The CRUD base limits a caller without CHANGE_SELECTED_EMPLOYEE to their own employee, but a caller
 * with no employee record at all (a viewer, a candidate) kept the tenant-wide scope: `GET /employee-appointment`,
 * `GET /appointment-employees/employee-appointments/:employeeId` and the update and delete routes reached every
 * employee's rows. Availability slots already scope such a caller to no row; appointments now do too.
 */
describe.each([
	[
		'EmployeeAppointmentService',
		(repository: unknown) => new EmployeeAppointmentService(repository as never, {} as never)
	],
	[
		'AppointmentEmployeesService',
		(repository: unknown) => new AppointmentEmployeesService(repository as never, {} as never)
	]
])('%s — a caller with no employee record reaches no one’s appointments', (_name, build) => {
	const COLLEAGUE = 'colleague-employee';

	let restore: () => void;
	let findAll: jest.SpyInstance;
	let service: CrudService<any>;

	beforeEach(() => {
		findAll = jest.spyOn(CrudService.prototype, 'findAll').mockResolvedValue({ items: [], total: 0 } as never);
		service = build({ metadata: { tableName: 'appointment', hasColumnWithPropertyPath: () => true } }) as never;
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	const listedFor = async (employeeId?: string) => {
		await service.findAll({ where: { ...(employeeId && { employeeId }) } } as never);
		return findAll.mock.calls[0][0].where;
	};

	it('a viewer lists no appointment, named employee or not', async () => {
		({ restore } = asTenantUser(createTenantFixture()));

		expect(await listedFor(COLLEAGUE)).toMatchObject({ employeeId: In([]) });
		findAll.mockClear();
		expect(await listedFor()).toMatchObject({ employeeId: In([]) });
	});

	it('CONTROL: an employee lists their own, whatever the query names', async () => {
		({ restore } = asTenantUser(createTenantFixture({ user: { employeeId: 'own-employee' } as IUser })));

		expect(await listedFor(COLLEAGUE)).toMatchObject({ employeeId: 'own-employee' });
	});

	it('CONTROL: a caller who may act for other employees lists the employee they name', async () => {
		({ restore } = asTenantUser(createTenantFixture(), {
			permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
		}));

		expect(await listedFor(COLLEAGUE)).toMatchObject({ employeeId: COLLEAGUE });
	});
});
