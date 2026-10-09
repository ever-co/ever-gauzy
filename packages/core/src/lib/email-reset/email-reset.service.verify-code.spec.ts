// Only `verifyCode` is exercised. Loading the real collaborators drags in the auth/user/employee
// services and the whole entity graph, so they are replaced by their shapes.
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

import { RequestContext } from '../core/context';
import { EmailResetService } from './email-reset.service';

/**
 * `POST /email-reset/verify-change-email` moves the user to the address the code was e-mailed to.
 * Entering that code proves the user receives mail there, so the write records a fresh confirmation
 * for the NEW address — never the one made for the previous address — and drops any confirmation
 * link or code that was issued for the previous address.
 */
describe('EmailResetService.verifyCode', () => {
	const USER_ID = 'user-1';

	function build({ record, taken = false }: { record: any; taken?: boolean }) {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: USER_ID, email: 'ada@example.com' } as any);
		const update = jest.fn(async () => ({ affected: 1 }));
		const service: EmailResetService = Object.create(EmailResetService.prototype);
		Object.assign(service, {
			queryBus: { execute: jest.fn(async () => record) },
			userService: { update, checkIfExistsEmail: jest.fn(async () => taken) }
		});
		return { service, update };
	}

	afterEach(() => jest.restoreAllMocks());

	it('records a fresh confirmation for the new address and clears the previous link/code', async () => {
		const { service, update } = build({ record: { userId: USER_ID, email: 'new@example.com' } });
		const before = Date.now();

		await service.verifyCode({ code: 'ABCD1234' } as any);

		expect(update).toHaveBeenCalledTimes(1);
		const [criteria, values] = update.mock.calls[0] as any[];
		expect(criteria).toEqual({ id: USER_ID });
		expect(values).toEqual(
			expect.objectContaining({ email: 'new@example.com', emailToken: null, code: null, codeExpireAt: null })
		);
		expect(values.emailVerifiedAt).toBeInstanceOf(Date);
		expect(values.emailVerifiedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
	});

	it('changes nothing when the code does not match a pending request', async () => {
		const { service, update } = build({ record: null });

		await service.verifyCode({ code: 'WRONG000' } as any);

		expect(update).not.toHaveBeenCalled();
	});

	it('changes nothing when the new address is already taken', async () => {
		const { service, update } = build({ record: { userId: USER_ID, email: 'new@example.com' }, taken: true });

		await service.verifyCode({ code: 'ABCD1234' } as any);

		expect(update).not.toHaveBeenCalled();
	});
});
