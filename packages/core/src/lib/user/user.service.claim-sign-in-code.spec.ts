// Only the shape of UserService is needed here; importing it for real drags the whole core entity graph in (see
// user.service.account-status.spec.ts, same technique).
jest.mock('./user.entity', () => ({ User: class User {} }));
jest.mock('./repository/type-orm-user.repository', () => ({ TypeOrmUserRepository: class TypeOrmUserRepository {} }));
jest.mock('./repository/mikro-orm-user.repository', () => ({
	MikroOrmUserRepository: class MikroOrmUserRepository {}
}));
jest.mock('../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../tasks/task.service', () => ({ TaskService: class TaskService {} }));
jest.mock('../activity-log/activity-log.service', () => ({ ActivityLogService: class ActivityLogService {} }));
jest.mock('../password-hash/password-hash.service', () => ({ PasswordHashService: class PasswordHashService {} }));
jest.mock('./../core/crud', () => ({ TenantAwareCrudService: class TenantAwareCrudService {} }));

import { FindOperator } from 'typeorm';
import { UserService } from './user.service';

/**
 * The sign-in code an account without a password confirms "sign out my other sessions" with (ever-co/ever-gauzy#11921)
 * is checked and spent by one conditional write: only a matching, unexpired code of that user is claimed, and the same
 * code is then spent on the address's other accounts, as a sign-in spends it.
 */
describe('UserService.claimSignInCode', () => {
	const NOW = new Date('2026-11-14T10:00:00.000Z');

	function build(affected: number) {
		const typeOrmUserRepository = { update: jest.fn(async (_where: any, _update: any) => ({ affected })) };
		const service: UserService = Object.create(UserService.prototype);
		Object.assign(service, { ormType: 'typeorm', typeOrmUserRepository });
		const invalidateMagicCode = jest.spyOn(service, 'invalidateMagicCode').mockResolvedValue(1);
		return { service, typeOrmUserRepository, invalidateMagicCode };
	}

	it('claims the code of that user while it has not expired, then spends it on the address', async () => {
		const { service, typeOrmUserRepository, invalidateMagicCode } = build(1);

		await expect(service.claimSignInCode('marie', 'marie@ever.co', 'ABC123', NOW)).resolves.toBe(true);

		const [where, update] = typeOrmUserRepository.update.mock.calls[0];
		expect(where.id).toBe('marie');
		expect(where.code).toBe('ABC123');
		expect(where.codeExpireAt).toBeInstanceOf(FindOperator);
		expect(where.codeExpireAt.type).toBe('moreThanOrEqual');
		expect(where.codeExpireAt.value).toEqual(NOW);
		expect(update).toEqual({ code: null, codeExpireAt: null });
		expect(invalidateMagicCode).toHaveBeenCalledWith('marie@ever.co', 'ABC123');
	});

	it('answers false for a wrong, expired or spent code, and spends nothing else', async () => {
		const { service, invalidateMagicCode } = build(0);

		await expect(service.claimSignInCode('marie', 'marie@ever.co', 'WRONG1', NOW)).resolves.toBe(false);

		expect(invalidateMagicCode).not.toHaveBeenCalled();
	});
});
