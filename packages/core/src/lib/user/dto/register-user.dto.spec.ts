/**
 * 🛑 Keep this import first: RegisterUserDTO reaches entity-backed validators through RoleFeatureDTO.
 */
import '../../core/entities/internal';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateTenantDTO } from '../../tenant/dto/create-tenant.dto';
import { RegisterUserDTO } from './register-user.dto';

/**
 * `POST /auth/register` and `POST /tenant` both run the validation pipe with `whitelist: true`, so a
 * property the DTO does not declare is silently stripped. `stripeCheckoutSessionId` is new on both:
 *
 *  - an OLD client never sends it, and must register exactly as before (it is optional);
 *  - a NEW client talking to an OLD API has it stripped, not rejected (no `forbidNonWhitelisted`);
 *  - when it IS sent it must be shaped like a Checkout Session id, because the API puts it into a
 *    Stripe URL path.
 */

const SESSION = 'cs_live_a1FixtureSessionForBillingScopeTests000000000000000000000';

async function check<T extends object>(cls: new () => T, payload: Record<string, unknown>) {
	const dto = plainToInstance(cls, payload) as T;
	const errors: ValidationError[] = await validate(dto, { whitelist: true });
	return { dto: dto as any, errors };
}

const registration = (extra: Record<string, unknown> = {}) => ({
	password: 'correct-horse-battery',
	confirmPassword: 'correct-horse-battery',
	user: { email: 'founder@newco.test', firstName: 'Ada', lastName: 'Lovelace' },
	...extra
});

describe('RegisterUserDTO.stripeCheckoutSessionId', () => {
	it('an old client that never sends it registers exactly as before', async () => {
		const { dto, errors } = await check(RegisterUserDTO, registration());
		expect(errors).toEqual([]);
		expect(dto.stripeCheckoutSessionId).toBeUndefined();
	});

	it('keeps a well-formed live or test session id', async () => {
		for (const id of [SESSION, SESSION.replace('cs_live_', 'cs_test_')]) {
			const { dto, errors } = await check(RegisterUserDTO, registration({ stripeCheckoutSessionId: id }));
			expect(errors).toEqual([]);
			expect(dto.stripeCheckoutSessionId).toBe(id);
		}
	});

	it.each(['not-a-session', 'cs_live_../../customers/cus_x', 'sub_1234567890abc', 'cs_live_', ''])(
		'rejects %p rather than put it into a Stripe URL',
		async (value) => {
			const { errors } = await check(RegisterUserDTO, registration({ stripeCheckoutSessionId: value }));
			expect(errors.some((e) => e.property === 'stripeCheckoutSessionId')).toBe(true);
		}
	);

	// Control: `whitelist: true` really is in force here, so "it is kept" above is not vacuous.
	it('still strips a property the DTO does not declare', async () => {
		const { dto } = await check(RegisterUserDTO, registration({ stripeCustomerId: 'cus_victim' }));
		expect(dto.stripeCustomerId).toBeUndefined();
	});
});

describe('CreateTenantDTO.stripeCheckoutSessionId', () => {
	it('is optional, keeps a well-formed id, and rejects anything else', async () => {
		expect((await check(CreateTenantDTO, { name: 'NewCo' })).errors).toEqual([]);

		const kept = await check(CreateTenantDTO, { name: 'NewCo', stripeCheckoutSessionId: SESSION });
		expect(kept.errors).toEqual([]);
		expect(kept.dto.stripeCheckoutSessionId).toBe(SESSION);

		const bad = await check(CreateTenantDTO, { name: 'NewCo', stripeCheckoutSessionId: 'cus_victim' });
		expect(bad.errors.some((e) => e.property === 'stripeCheckoutSessionId')).toBe(true);
	});

	it('still refuses a client-chosen stripeCustomerId (stripped by the whitelist)', async () => {
		const { dto } = await check(CreateTenantDTO, { name: 'NewCo', stripeCustomerId: 'cus_victim' });
		expect(dto.stripeCustomerId).toBeUndefined();
	});
});
