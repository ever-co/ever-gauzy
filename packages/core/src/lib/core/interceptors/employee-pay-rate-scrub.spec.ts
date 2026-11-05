import * as fs from 'fs';
import * as path from 'path';
import { buildSchema, GraphQLInputObjectType, GraphQLObjectType, parse, validate } from 'graphql';
import { scrubUserCredentials } from './user-credential-scrub';

/**
 * A pay rate is salary data. Whatever a caller asks a generic read for, no response row carries it: the response walk
 * removes it from every serialized row, a team's members included, and GraphQL offers no field or filter for it (a
 * GraphQL team carries its members' employee ids only, read from the employee surface).
 * The pay rate route answers an object without an `id`, the one shape that keeps it.
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

	it('keeps the pay rate route answer, which has no id', () => {
		const answer = { employeeId: 'employee-1', payRateValue: 30, payRateCurrency: 'USD', currency: 'USD' };

		expect(scrubUserCredentials({ ...answer })).toEqual(answer);
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
