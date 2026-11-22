import { IEmployee } from '@gauzy/contracts';
import { setEmployeeFullName } from './employee-full-name';

describe('setEmployeeFullName', () => {
	it('names the employee after their loaded user', () => {
		const employee = { id: 'employee', user: { name: 'Ada Lovelace' } } as IEmployee;

		setEmployeeFullName(employee);

		expect(employee.fullName).toBe('Ada Lovelace');
	});

	it('leaves an employee read without their user unnamed', () => {
		const employee = { id: 'employee' } as IEmployee;

		setEmployeeFullName(employee);

		expect(employee).not.toHaveProperty('fullName');
	});

	it('keeps the name an employee has when their user has none', () => {
		const employee = { id: 'employee', fullName: 'Grace Hopper', user: { name: '' } } as IEmployee;

		setEmployeeFullName(employee);

		expect(employee.fullName).toBe('Grace Hopper');
	});
});
