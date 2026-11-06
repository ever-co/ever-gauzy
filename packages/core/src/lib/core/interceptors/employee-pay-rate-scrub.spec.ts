import '../entities/internal';

import * as fs from 'fs';
import * as path from 'path';
import { buildSchema, GraphQLInputObjectType, GraphQLObjectType, parse, validate } from 'graphql';
import { lastValueFrom, of } from 'rxjs';
import { scrubUserCredentials } from './user-credential-scrub';
import { RESPONDS_WITH_PAY_RATE, RespondsWithPayRate } from './employee-pay-rate-scrub';
import { TransformInterceptor } from './transform.interceptor';
import { EmployeeController } from '../../employee/employee.controller';

/**
 * A pay rate is salary data. Whatever a caller asks a generic read for, no response row carries it: the response walk
 * removes it from every serialized row, a team's members included, and GraphQL offers no field or filter for it (a
 * GraphQL team carries its members' employee ids only, read from the employee surface).
 * Only the pay rate route, marked with `RespondsWithPayRate`, keeps it.
 */
describe('employee pay rate in responses', () => {
	it("removes the pay rate from a team's members, and keeps everything else", () => {
		const body = {
			items: [
				{
					id: 'team-1',
					members: [
						{
							id: 'membership-1',
							employee: {
								id: 'employee-1',
								billRateValue: 80,
								payRateValue: 30,
								payRateCurrency: 'USD'
							}
						}
					]
				}
			],
			total: 1
		};

		const scrubbed = scrubUserCredentials(body);

		expect(scrubbed.items[0].members[0].employee).toEqual({ id: 'employee-1', billRateValue: 80 });
		expect(scrubbed.total).toBe(1);
	});

	it('removes the pay rate from a row a select left without its id', () => {
		// `?select[]=payRateValue&select[]=userId` answers rows with only the selected columns
		const body = { items: [{ payRateValue: 30, userId: 'user-1' }], total: 1 };

		const scrubbed = scrubUserCredentials(body);

		expect(scrubbed.items[0]).toEqual({ userId: 'user-1' });
	});

	it('keeps the pay rate on the pay rate route only', () => {
		const answer = { employeeId: 'employee-1', payRateValue: 30, payRateCurrency: 'USD', currency: 'USD' };

		expect(scrubUserCredentials({ ...answer }, { keepPayRate: true })).toEqual(answer);
		expect(scrubUserCredentials({ ...answer })).toEqual({ employeeId: 'employee-1', currency: 'USD' });
	});

	describe('TransformInterceptor', () => {
		class Routes {
			@RespondsWithPayRate()
			payRate() {
				return undefined;
			}

			other() {
				return undefined;
			}
		}

		const answer = () => ({ employeeId: 'employee-1', payRateValue: 30, payRateCurrency: 'USD', currency: 'USD' });
		const run = (handler: () => unknown) =>
			lastValueFrom(
				new TransformInterceptor().intercept({ getHandler: () => handler } as never, { handle: () => of(answer()) })
			);

		it('keeps the pay rate on a route marked RespondsWithPayRate', async () => {
			await expect(run(Routes.prototype.payRate)).resolves.toEqual(answer());
		});

		it('removes it on any other route', async () => {
			await expect(run(Routes.prototype.other)).resolves.toEqual({ employeeId: 'employee-1', currency: 'USD' });
		});

		it('marks the pay rate route, and only it, of the employee controller', () => {
			const marked = (method: string) =>
				Reflect.getMetadata(RESPONDS_WITH_PAY_RATE, EmployeeController.prototype[method]) === true;

			expect(marked('findPayRate')).toBe(true);
			expect(marked('findAll')).toBe(false);
			expect(marked('findById')).toBe(false);
		});
	});

	describe('GraphQL', () => {
		const sdl = fs.readFileSync(path.join(__dirname, '../../graphql/schema/schema.graphql'), 'utf8');
		const schema = buildSchema(sdl, { assumeValidSDL: true });
		const payRateFields = ['payRateValue', 'payRateCurrency'];

		it.each(['Employee', 'EmployeeFilter', 'WorkingEmployeeFilter'])('%s declares no pay rate field', (name) => {
			const type = schema.getType(name) as GraphQLObjectType | GraphQLInputObjectType;
			const fields = Object.keys(type.getFields());

			expect(fields).toEqual(expect.arrayContaining(['billRateValue']));
			for (const field of payRateFields) {
				expect(fields).not.toContain(field);
			}
		});

		it("refuses a query that selects an employee's pay rate, or filters by it", () => {
			const selects = parse('{ employee(id: "employee-1") { id payRateValue } }');
			const filters = parse('{ employees(filter: { payRateValue: { gt: 10 } }) { totalCount } }');

			const selectErrors = validate(schema, selects);
			const filterErrors = validate(schema, filters);

			expect(selectErrors).toHaveLength(1);
			expect(selectErrors[0].message).toContain('Cannot query field "payRateValue" on type "Employee".');
			expect(filterErrors.some((error) => error.message.includes('payRateValue'))).toBe(true);
		});
	});
});
