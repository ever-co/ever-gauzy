import { lastValueFrom, of } from 'rxjs';
import { Exclude, instanceToPlain } from 'class-transformer';
import { scrubUserCredentials, USER_CREDENTIAL_KEYS } from './user-credential-scrub';
import { TransformInterceptor } from './transform.interceptor';

/**
 * GHSA-hh83-hq74-gh9f — credential columns leaking through prototype-less users.
 *
 * `@Exclude` is found through the prototype, so a user that reaches `TransformInterceptor` as a plain
 * object — an object spread of an entity, or what `CrudService.serialize()` returns under
 * DB_ORM=mikro-orm (`wrap(entity).toJSON()`) — was serialized with its password hash, refresh token
 * and one-time codes. The interceptor now scrubs every user-shaped object after `instanceToPlain`.
 */

/** Minimal stand-in for the entity: same `@Exclude` set as `User`. */
class UserLike {
	id: string;
	email: string;
	@Exclude({ toPlainOnly: true }) hash?: string;
	@Exclude({ toPlainOnly: true }) refreshToken?: string;
	@Exclude({ toPlainOnly: true }) code?: string;
	@Exclude({ toPlainOnly: true }) codeExpireAt?: Date;
	@Exclude({ toPlainOnly: true }) emailToken?: string;
	@Exclude({ toPlainOnly: true }) emailVerifiedAt?: Date;

	constructor(input: Partial<UserLike>) {
		Object.assign(this, input);
	}
}

const credentials = () => ({
	hash: '$2b$12$digest',
	refreshToken: 'hashed-refresh',
	code: '123456',
	codeExpireAt: new Date('2026-01-01T00:00:00Z'),
	emailToken: 'hashed-email-token',
	emailVerifiedAt: new Date('2026-01-01T00:00:00Z')
});

/** A paginated `/user-organization` body whose users lost their prototype (MikroORM toJSON). */
const leakyBody = () => ({
	items: [
		{
			id: 'uo-1',
			user: { id: 'u-1', email: 'ada@example.com', firstName: 'Ada', ...credentials() },
			createdByUser: { id: 'u-2', email: 'root@example.com', ...credentials() }
		}
	],
	total: 1
});

async function runInterceptor(data: unknown): Promise<any> {
	const interceptor = new TransformInterceptor();
	return lastValueFrom(interceptor.intercept({} as any, { handle: () => of(data) }));
}

describe('user credential scrub (GHSA-hh83-hq74-gh9f)', () => {
	it('CONTROL: instanceToPlain alone serializes a prototype-less user verbatim', () => {
		const plain: any = instanceToPlain(leakyBody());
		expect(plain.items[0].user.hash).toBe('$2b$12$digest');
		expect(plain.items[0].createdByUser.refreshToken).toBe('hashed-refresh');
	});

	it('CONTROL: instanceToPlain does redact a real instance (why the leak needs a lost prototype)', () => {
		const plain: any = instanceToPlain(new UserLike({ id: 'u-1', email: 'ada@example.com', ...credentials() }));
		for (const key of USER_CREDENTIAL_KEYS) {
			expect(plain).not.toHaveProperty(key);
		}
	});

	it('TransformInterceptor strips every credential column from nested prototype-less users', async () => {
		const body = await runInterceptor(leakyBody());

		for (const user of [body.items[0].user, body.items[0].createdByUser]) {
			for (const key of USER_CREDENTIAL_KEYS) {
				expect(user).not.toHaveProperty(key);
			}
		}
		// Everything else is untouched.
		expect(body.items[0].user).toEqual({ id: 'u-1', email: 'ada@example.com', firstName: 'Ada' });
		expect(body.total).toBe(1);
	});

	it('handles a top-level array and a top-level user', async () => {
		expect(await runInterceptor([{ email: 'a@example.com', hash: 'x', name: 'A' }])).toEqual([
			{ email: 'a@example.com', name: 'A' }
		]);
		expect(scrubUserCredentials({ email: 'a@example.com', hash: null, code: null })).toEqual({ email: 'a@example.com' });
	});

	it('leaves `code` and `token` alone on objects that are not users', async () => {
		const body = {
			currency: { code: 'USD', name: 'Dollar' },
			product: { code: 'SKU-1', email: 'sales@example.com' },
			invite: { email: 'x@example.com', code: 'ABC123', token: 't' }
		};
		expect(await runInterceptor(body)).toEqual(body);
	});

	it('passes primitives, empty bodies and Dates through', async () => {
		expect(await runInterceptor('ok')).toBe('ok');
		expect(await runInterceptor(undefined)).toBeUndefined();
		expect(scrubUserCredentials(null)).toBeNull();
		const date = new Date();
		expect(scrubUserCredentials(date)).toBe(date);
	});

	/**
	 * The shape test keys off the columns only `User` has, not off `hash` alone: under DB_ORM=mikro-orm
	 * a projected read (`?select[...]`) can serialize a user WITHOUT `hash` but WITH `emailToken` or
	 * `refreshToken`, and a `hash`-only test let that through.
	 */
	describe('a user projected without hash', () => {
		/** Verbatim copy of the narrower shape test, to show what it missed. */
		const hashOnlyShapeTest = (value: Record<string, unknown>) => 'email' in value && 'hash' in value;

		it.each([['emailToken', 'hashed-email-token'], ['refreshToken', 'hashed-refresh']])(
			'CONTROL: the hash-only shape test did not recognize a user carrying only %s',
			(key, value) => {
				expect(hashOnlyShapeTest({ id: 'u-1', email: 'ada@example.com', [key]: value })).toBe(false);
			}
		);

		it.each([['emailToken', 'hashed-email-token'], ['refreshToken', 'hashed-refresh']])(
			'is still scrubbed when it carries only %s',
			 async (key, value) => {
				const body = await runInterceptor({ items: [{ id: 'u-1', email: 'ada@example.com', [key]: value }] });
				expect(body.items[0]).toEqual({ id: 'u-1', email: 'ada@example.com' });
			}
		);

		it('still leaves an invite (email + code, no user-only column) alone', async () => {
			const invite = { email: 'x@example.com', code: 'ABC123', token: 't' };
			expect(await runInterceptor({ invite })).toEqual({ invite });
		});
	});

	it('survives a cyclic structure', () => {
		const user: any = { email: 'a@example.com', hash: 'x' };
		const node: any = { user };
		user.self = node;
		expect(() => scrubUserCredentials(node)).not.toThrow();
		expect(user).not.toHaveProperty('hash');
	});
});
