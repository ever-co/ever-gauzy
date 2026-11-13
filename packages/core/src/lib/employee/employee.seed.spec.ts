/**
 * Importing `Employee` reaches `core/entities/internal` and the decorator graph. Loading that
 * graph FIRST matches the application boot order (see employee.entity.spec.ts).
 */
import '../core/entities/internal';

import { DataSource } from 'typeorm';
import { IOrganization, ITenant, IUser, RolesEnum } from '@gauzy/contracts';
import { DEFAULT_ADMINS, DEFAULT_SUPER_ADMINS } from '../user/default-users';
import { DEFAULT_EMPLOYEES, DEFAULT_EVER_EMPLOYEES } from './default-employees';
import { Employee } from './employee.entity';
import { createDefaultEmployees } from './employee.seed';
import { EmployeeSubscriber } from './employee.subscriber';

/**
 * ever-co/ever-teams#5015: the seed makes the default super admins and admins employees too (Ever Teams' demo signs
 * in with them), but they have no default employee entry, so they got no start date. The EmployeeSubscriber turns
 * time tracking on only for an employee who has started work, so theirs stayed at the column's default, off: on the
 * demo the admins, and Ronan, whose entry has no date either, could not track time.
 */
describe('createDefaultEmployees — every seeded user can track time', () => {
	const tenant = { id: 'tenant-1' } as ITenant;
	const organization = { id: 'org-1', tenantId: 'tenant-1', currency: 'USD' } as IOrganization;
	const defaultEmployees = DEFAULT_EMPLOYEES.concat(DEFAULT_EVER_EMPLOYEES);
	const adminEmails = [...DEFAULT_SUPER_ADMINS, ...DEFAULT_ADMINS].map(({ email }) => email);

	/** The users the seed turns into employees, with the role it sets on them in memory before the insert. */
	function seededUsers(): IUser[] {
		const withRole = (entries: Array<{ email: string }>, role: RolesEnum) =>
			entries.map((entry) => ({ ...entry, role: { name: role } }) as IUser);
		return [
			...withRole(DEFAULT_SUPER_ADMINS, RolesEnum.SUPER_ADMIN),
			...withRole(DEFAULT_ADMINS, RolesEnum.ADMIN),
			...withRole(defaultEmployees, RolesEnum.EMPLOYEE)
		];
	}

	async function seed(): Promise<Employee[]> {
		const save = jest.fn(async (employees: Employee[]) => employees);
		const dataSource = { manager: { save } } as unknown as DataSource;
		const users = seededUsers();
		const employees = await createDefaultEmployees(dataSource, tenant, organization, users, defaultEmployees);
		expect(save).toHaveBeenCalledWith(employees);
		return employees as Employee[];
	}

	afterEach(() => jest.restoreAllMocks());

	it('gives the default super admins and admins, which have no employee entry, a start date', async () => {
		const employees = await seed();

		const admins = employees.filter(({ user }) => adminEmails.includes(user.email));
		expect(admins.map(({ user }) => user.email)).toEqual(adminEmails);
		for (const admin of admins) {
			expect(admin.startedWorkOn).toEqual(new Date('2018-03-20'));
		}
	});

	it('keeps the start date a default entry gives', async () => {
		const employees = await seed();

		const dated = defaultEmployees.filter(({ startedWorkOn }) => startedWorkOn);
		expect(dated.length).toBeGreaterThan(0);
		for (const entry of dated) {
			const employee = employees.find(({ user }) => user.email === entry.email);
			expect(employee.startedWorkOn).toEqual(new Date(entry.startedWorkOn));
		}
	});

	it('lets every seeded user track time once the employee subscriber has run', async () => {
		const employees = await seed();
		const subscriber = new EmployeeSubscriber();

		for (const employee of employees) {
			await subscriber.beforeEntityCreate(employee);
		}

		const cannotTrack = employees.filter(({ isTrackingEnabled, isActive }) => !isTrackingEnabled || !isActive);
		expect(cannotTrack.map(({ user }) => user.email)).toEqual([]);
		expect(employees).toHaveLength(adminEmails.length + defaultEmployees.length);
	});
});
