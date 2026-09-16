/**
 * Importing `Employee` reaches `core/entities/internal` and the decorator graph. Loading that
 * graph FIRST matches the application boot order and avoids the
 * "IsEmployeeBelongsToOrganization is not a function" cycle other employee specs hit.
 */
import '../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { Employee } from './employee.entity';

/**
 * `PUT /employee/:id` and the rates form run class-transformer over `UpdateProfileDTO`, which
 * picks `billRateValue` / `minimumBillingRate` / `reWeeklyLimit` from this entity. `parseInt`
 * used to drop cents so `10.49` became `10` (#10199). Weekly limit stays hours (integer).
 */
describe('Employee billing rate transforms', () => {
	it('keeps two decimal places on billRateValue and minimumBillingRate', () => {
		const employee = plainToInstance(Employee, {
			billRateValue: '10.49',
			minimumBillingRate: 12.5
		});

		expect(employee.billRateValue).toBe(10.49);
		expect(employee.minimumBillingRate).toBe(12.5);
	});

	it('rounds monetary rates to two decimal places', () => {
		const employee = plainToInstance(Employee, { billRateValue: 10.499 });

		expect(employee.billRateValue).toBe(10.5);
	});

	it('rounds half-cents up instead of using binary toFixed', () => {
		const employee = plainToInstance(Employee, { billRateValue: 1.005 });

		expect(employee.billRateValue).toBe(1.01);
	});

	it('leaves non-numeric rates as NaN so @IsNumber rejects them, and keeps leading-number parsing', () => {
		const employee = plainToInstance(Employee, { billRateValue: 'abc', minimumBillingRate: '10,50' });

		expect(employee.billRateValue).toBeNaN();
		expect(employee.minimumBillingRate).toBe(10);
	});

	it('stores empty rates as 0, as before', () => {
		const employee = plainToInstance(Employee, { billRateValue: '', minimumBillingRate: null });

		expect(employee.billRateValue).toBe(0);
		expect(employee.minimumBillingRate).toBe(0);
	});

	it('keeps rates above the old numeric(10,2) ceiling', () => {
		const employee = plainToInstance(Employee, { billRateValue: 2147483647 });

		expect(employee.billRateValue).toBe(2147483647);
	});

	it('still parses reWeeklyLimit as whole hours', () => {
		const employee = plainToInstance(Employee, { reWeeklyLimit: '37.9' });

		expect(employee.reWeeklyLimit).toBe(37);
	});
});
