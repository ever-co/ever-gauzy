/**
 * Importing `Employee` reaches `core/entities/internal` and the decorator graph: load that graph first, as the
 * application boot does.
 */
import '../core/entities/internal';

import { IEmployee } from '@gauzy/contracts';
import { Employee } from './employee.entity';
import { setEmployeeFullName, setLoadedEmployeesFullName } from './employee-full-name';

const employee = (id: string, userName?: string): Employee => {
	const loaded = Object.assign(new Employee(), { id });
	if (userName !== undefined) {
		loaded.user = { name: userName } as Employee['user'];
	}
	return loaded;
};

describe('setEmployeeFullName', () => {
	it('names the employee after their loaded user', () => {
		const loaded = { id: 'employee', user: { name: 'Ada Lovelace' } } as IEmployee;

		setEmployeeFullName(loaded);

		expect(loaded.fullName).toBe('Ada Lovelace');
	});

	it('leaves an employee read without their user unnamed', () => {
		const loaded = { id: 'employee' } as IEmployee;

		setEmployeeFullName(loaded);

		expect(loaded).not.toHaveProperty('fullName');
	});

	it('keeps the name an employee has when their user has none', () => {
		const loaded = { id: 'employee', fullName: 'Grace Hopper', user: { name: '' } } as IEmployee;

		setEmployeeFullName(loaded);

		expect(loaded.fullName).toBe('Grace Hopper');
	});
});

describe('setLoadedEmployeesFullName', () => {
	it('names every employee along the loaded relations: a to-one employee and the members of each task', () => {
		const owner = employee('ada', 'Ada Lovelace');
		const assignee = employee('grace', 'Grace Hopper');
		const plan = { id: 'plan', employee: owner, tasks: [{ id: 'task', members: [owner, assignee] }] };

		setLoadedEmployeesFullName([plan], { employee: { user: true }, tasks: { members: { user: true } } });

		expect(owner.fullName).toBe('Ada Lovelace');
		expect(assignee.fullName).toBe('Grace Hopper');
	});

	it('names the employees given themselves', () => {
		const loaded = employee('ada', 'Ada Lovelace');

		setLoadedEmployeesFullName([loaded], { user: true });

		expect(loaded.fullName).toBe('Ada Lovelace');
	});

	it('follows only the relations it is given', () => {
		const assignee = employee('grace', 'Grace Hopper');
		const plan = {
			id: 'plan',
			employee: employee('ada', 'Ada Lovelace'),
			tasks: [{ id: 'task', members: [assignee] }]
		};

		setLoadedEmployeesFullName([plan], { employee: { user: true }, tasks: true });

		expect(plan.employee.fullName).toBe('Ada Lovelace');
		expect(assignee.fullName).toBeUndefined();
	});

	it('passes over a relation that loaded nothing and an employee loaded without their user', () => {
		const withoutUser = employee('linus');
		const plans = [
			{ id: 'no-employee', employee: null, tasks: [] },
			{ id: 'no-user', employee: withoutUser, tasks: undefined }
		];

		expect(() =>
			setLoadedEmployeesFullName(plans, { employee: { user: true }, tasks: { members: true } })
		).not.toThrow();
		expect(withoutUser.fullName).toBeUndefined();
	});

	it('names no object that is not an employee', () => {
		const candidate = { id: 'candidate', user: { name: 'Ada Lovelace' } };

		setLoadedEmployeesFullName([{ id: 'plan', candidate }], { candidate: { user: true } });

		expect(candidate).not.toHaveProperty('fullName');
	});
});
