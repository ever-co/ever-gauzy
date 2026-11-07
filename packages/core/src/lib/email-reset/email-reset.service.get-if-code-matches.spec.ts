// Only `getEmailResetIfCodeMatches` is exercised. Loading the real collaborators drags in the auth/user/employee
// services and the whole entity graph, so they are replaced by their shapes (as email-reset.service.verify-code.spec.ts).
jest.mock('../user/user.service', () => ({ UserService: class UserService {} }));
jest.mock('./../email-send/email.service', () => ({ EmailService: class EmailService {} }));
jest.mock('./../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('./../auth/auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('../core/crud', () => ({ TenantAwareCrudService: class TenantAwareCrudService {} }));
jest.mock('./repository/type-orm-email-reset.repository', () => ({
	TypeOrmEmailResetRepository: class TypeOrmEmailResetRepository {}
}));
jest.mock('./repository/mikro-orm-email-reset.repository', () => ({
	MikroOrmEmailResetRepository: class MikroOrmEmailResetRepository {}
}));
jest.mock('../user/dto', () => ({ UserEmailDTO: class UserEmailDTO {} }));
jest.mock('./email-reset.entity', () => ({ EmailReset: class EmailReset {} }));
jest.mock('./commands', () => ({ EmailResetCreateCommand: class EmailResetCreateCommand {} }));
jest.mock('./queries', () => ({
	EmailResetGetQuery: class EmailResetGetQuery {
		constructor(public readonly input: unknown) {}
	}
}));
jest.mock('./dto/verify-email-reset-request.dto', () => ({ VerifyEmailResetRequestDTO: class {} }));

import { EmailResetService } from './email-reset.service';

/**
 * The code a user types is matched against their newest unexpired reset request. The lookup orders by `createdAt`
 * and reads its answer through `getOneOrFail`, which keeps the first row of whatever the query returns: without a
 * row limit every unexpired request of the address came back for the one that was used. The query now asks for
 * one row.
 */
describe('EmailResetService.getEmailResetIfCodeMatches', () => {
	const NEWEST = { id: 'reset-newest', code: 123456, email: 'ada@example.com' };

	/** A query builder that records its calls and answers `NEWEST`. */
	function recordingQuery(calls: unknown[][]) {
		const record =
			(name: string) =>
			(...args: unknown[]) => {
				calls.push([name, ...args]);
				return query;
			};
		const query: any = {
			alias: 'email_reset',
			where: record('where'),
			andWhere: record('andWhere'),
			orderBy: record('orderBy'),
			limit: record('limit'),
			getOneOrFail: jest.fn(async () => NEWEST)
		};
		return query;
	}

	it('reads one row, the newest by createdAt', async () => {
		const calls: unknown[][] = [];
		const query = recordingQuery(calls);
		const service: EmailResetService = Object.create(EmailResetService.prototype);
		Object.assign(service, { ormType: 'typeorm', typeOrmRepository: { createQueryBuilder: () => query } });

		const found = await service.getEmailResetIfCodeMatches({ email: 'ada@example.com', code: 123456 } as any);

		expect(found).toBe(NEWEST);
		const names = calls.map(([name]) => name);
		// CONTROL: the ordering that makes "first row" mean "newest" is still there
		expect(calls).toContainEqual(['orderBy', '"email_reset"."createdAt"', 'DESC']);
		expect(calls).toContainEqual(['limit', 1]);
		expect(names.indexOf('limit')).toBeGreaterThan(names.indexOf('orderBy'));
		expect(query.getOneOrFail).toHaveBeenCalledTimes(1);
	});
});
