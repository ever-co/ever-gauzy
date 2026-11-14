// cspell:ignore otpauth
import '../../core/entities/internal';

import { HttpException, HttpStatus } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { coreEntities } from '../../core/entities';
import { Organization, Tenant, User, UserTwoFactor } from '../../core/entities/internal';
import { insertRow } from '../../database/testing/insert-row';
import { LoginAttemptService } from '../login-attempt.service';
import { TypeOrmUserTwoFactorRepository } from './repository/type-orm-user-two-factor.repository';
import { decodeBase32, totpAt } from './totp';
import { UserTwoFactorService } from './user-two-factor.service';

/**
 * `UserTwoFactorService` on a real SQLite database built from the entities: the enrolment, the confirmation and the
 * recovery codes it answers once, codes accepted once each (replay), the count of wrong codes (the sixth in a row is
 * blocked), turning it off, replacing the recovery codes, an administrator's reset, and the organization rule.
 */

const TIMEOUT = 10 * 60 * 1000;
const TENANT = '9c000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '9c000000-0000-4000-8000-0000000000a1';
const STRICT_ORGANIZATION = '9c000000-0000-4000-8000-0000000000a2';
const ADMIN = '9c000000-0000-4000-8000-0000000000c1';

/** The status of an HTTP error thrown by `promise`, or -1. */
async function statusOf(promise: Promise<unknown>): Promise<number> {
	try {
		await promise;
		return 0;
	} catch (error) {
		return error instanceof HttpException ? error.getStatus() : -1;
	}
}

describe('UserTwoFactorService', () => {
	const previousKey = process.env.ENCRYPTION_KEY;
	let dataSource: DataSource;
	let service: UserTwoFactorService;
	let now: number;
	let userCount = 0;

	/** A new user of the tenant, so that tests do not share counters or rows. */
	const newUser = async () => {
		userCount++;
		const id = `9c000000-0000-4000-8000-${String(userCount).padStart(12, '0')}`;
		await insertRow(dataSource, User, { id, tenantId: TENANT, email: `user${userCount}@example.com` });
		return { id, tenantId: TENANT, email: `user${userCount}@example.com` };
	};

	/** The code the app shows at `now` for a secret. */
	const codeAt = (secret: string, at: number = now) => totpAt(secret, at);

	/** A user with two-factor authentication on: their secret and recovery codes. */
	const enabledUser = async () => {
		const user = await newUser();
		const { secret } = await service.enroll(user);
		const { recoveryCodes } = await service.confirm(user.id, codeAt(secret));
		now += 30_000;
		return { user, secret, recoveryCodes };
	};

	beforeAll(async () => {
		process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		await insertRow(dataSource, Tenant, { id: TENANT, name: 'Tenant' });
		await insertRow(dataSource, Organization, { id: ORGANIZATION, tenantId: TENANT, name: 'Studio' });
		await insertRow(dataSource, Organization, {
			id: STRICT_ORGANIZATION,
			tenantId: TENANT,
			name: 'Labs',
			requireTwoFactor: true
		});
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
		if (previousKey === undefined) {
			delete process.env.ENCRYPTION_KEY;
		} else {
			process.env.ENCRYPTION_KEY = previousKey;
		}
	});

	beforeEach(() => {
		now = Date.UTC(2026, 10, 13, 9, 0, 0);
		jest.spyOn(Date, 'now').mockImplementation(() => now);
		const repository = new TypeOrmUserTwoFactorRepository(dataSource.getRepository(UserTwoFactor));
		service = new UserTwoFactorService(
			repository,
			undefined,
			new EncryptionService(),
			new LoginAttemptService(null)
		);
		jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses an enrolment on a server without ENCRYPTION_KEY, saying what to set', async () => {
		const user = await newUser();
		const key = process.env.ENCRYPTION_KEY;
		delete process.env.ENCRYPTION_KEY;
		try {
			await expect(service.enroll(user)).rejects.toThrow(/set ENCRYPTION_KEY/);
		} finally {
			process.env.ENCRYPTION_KEY = key;
		}
		expect((await service.statusOf(user.id, false)).pendingEnrollment).toBe(false);
	});

	it(
		'answers a secret and its otpauth address, keeps it encrypted, and changes nothing before a first code',
		async () => {
			const user = await newUser();

			const enrollment = await service.enroll(user, 'Ever Teams');

			expect(decodeBase32(enrollment.secret)).toHaveLength(20);
			expect(enrollment.otpauthUrl).toBe(
				`otpauth://totp/Ever%20Teams:${encodeURIComponent(user.email)}?secret=${enrollment.secret}&issuer=Ever%20Teams&algorithm=SHA1&digits=6&period=30`
			);
			const [row] = await dataSource.query(
				`SELECT "secret", "enabledAt" FROM "user_two_factor" WHERE "userId" = ?`,
				[user.id]
			);
			expect(row.secret).not.toContain(enrollment.secret);
			expect(row.enabledAt).toBeNull();
			expect(await service.isEnabled(user.id)).toBe(false);
			expect(await service.statusOf(user.id, false)).toEqual(
				expect.objectContaining({
					available: true,
					enabled: false,
					pendingEnrollment: true,
					recoveryCodesLeft: 0
				})
			);
		},
		TIMEOUT
	);

	it(
		'turns on with the first right code only, and answers ten recovery codes',
		async () => {
			const user = await newUser();
			const { secret } = await service.enroll(user);

			expect(await statusOf(service.confirm(user.id, '000000'))).toBe(HttpStatus.UNAUTHORIZED);
			expect(await service.isEnabled(user.id)).toBe(false);

			const confirmation = await service.confirm(user.id, codeAt(secret));

			expect(confirmation.recoveryCodes).toHaveLength(10);
			expect(await service.isEnabled(user.id)).toBe(true);
			expect(await service.statusOf(user.id, false)).toEqual(
				expect.objectContaining({ enabled: true, pendingEnrollment: false, recoveryCodesLeft: 10 })
			);
			expect(await statusOf(service.enroll(user))).toBe(HttpStatus.CONFLICT);
		},
		TIMEOUT
	);

	it(
		'accepts a code once: the same code a second time is refused',
		async () => {
			const { user, secret } = await enabledUser();
			const code = codeAt(secret);

			await expect(service.verifySecondFactor(user.id, { code })).resolves.toBeUndefined();
			expect(await statusOf(service.verifySecondFactor(user.id, { code }))).toBe(HttpStatus.UNAUTHORIZED);

			now += 30_000;
			await expect(service.verifySecondFactor(user.id, { code: codeAt(secret) })).resolves.toBeUndefined();
		},
		TIMEOUT
	);

	it(
		'accepts a recovery code once, typed in any case',
		async () => {
			const { user, recoveryCodes } = await enabledUser();

			await expect(
				service.verifySecondFactor(user.id, { recoveryCode: recoveryCodes[2].toLowerCase() })
			).resolves.toBeUndefined();
			expect(await statusOf(service.verifySecondFactor(user.id, { recoveryCode: recoveryCodes[2] }))).toBe(
				HttpStatus.UNAUTHORIZED
			);
			expect((await service.statusOf(user.id, false)).recoveryCodesLeft).toBe(9);
		},
		TIMEOUT
	);

	it(
		'refuses the sixth try after five wrong codes in a row, even with the right code',
		async () => {
			const { user, secret } = await enabledUser();

			for (let i = 0; i < 5; i++) {
				expect(await statusOf(service.verifySecondFactor(user.id, { code: '000000' }))).toBe(
					HttpStatus.UNAUTHORIZED
				);
			}

			expect(await statusOf(service.verifySecondFactor(user.id, { code: codeAt(secret) }))).toBe(
				HttpStatus.TOO_MANY_REQUESTS
			);
		},
		TIMEOUT
	);

	it(
		'does not count a check of an account without two-factor authentication',
		async () => {
			const user = await newUser();

			for (let i = 0; i < 7; i++) {
				expect(await statusOf(service.verifySecondFactor(user.id, { code: '000000' }))).toBe(
					HttpStatus.UNAUTHORIZED
				);
			}
		},
		TIMEOUT
	);

	it(
		'turns off with a current code, and forgets the secret and the recovery codes',
		async () => {
			const { user, secret, recoveryCodes } = await enabledUser();

			await service.disable(user.id, { code: codeAt(secret) });

			expect(await service.isEnabled(user.id)).toBe(false);
			const [row] = await dataSource.query(
				`SELECT "secret", "recoveryCodes" FROM "user_two_factor" WHERE "userId" = ?`,
				[user.id]
			);
			expect(row).toEqual({ secret: null, recoveryCodes: null });
			expect(await statusOf(service.verifySecondFactor(user.id, { recoveryCode: recoveryCodes[0] }))).toBe(
				HttpStatus.UNAUTHORIZED
			);
		},
		TIMEOUT
	);

	it(
		'does not turn off without a right proof',
		async () => {
			const { user } = await enabledUser();

			expect(await statusOf(service.disable(user.id, { code: '000000' }))).toBe(HttpStatus.UNAUTHORIZED);
			expect(await service.isEnabled(user.id)).toBe(true);
		},
		TIMEOUT
	);

	it(
		'replaces the recovery codes: the old ones stop working, the new ones work',
		async () => {
			const { user, secret, recoveryCodes } = await enabledUser();

			const fresh = await service.regenerateRecoveryCodes(user.id, { code: codeAt(secret) });

			expect(fresh.recoveryCodes).toHaveLength(10);
			expect(await statusOf(service.verifySecondFactor(user.id, { recoveryCode: recoveryCodes[0] }))).toBe(
				HttpStatus.UNAUTHORIZED
			);
			await expect(
				service.verifySecondFactor(user.id, { recoveryCode: fresh.recoveryCodes[0] })
			).resolves.toBeUndefined();
		},
		TIMEOUT
	);

	it(
		'records an administrator reset, and answers false when there was nothing to reset',
		async () => {
			const { user } = await enabledUser();
			const stranger = await newUser();

			await expect(service.resetByAdministrator(user.id, ADMIN)).resolves.toBe(true);
			await expect(service.resetByAdministrator(stranger.id, ADMIN)).resolves.toBe(false);

			expect(await service.isEnabled(user.id)).toBe(false);
			const [row] = await dataSource.query(
				`SELECT "secret", "resetAt", "resetByUserId" FROM "user_two_factor" WHERE "userId" = ?`,
				[user.id]
			);
			expect(row.secret).toBeNull();
			expect(row.resetAt).not.toBeNull();
			expect(row.resetByUserId).toBe(ADMIN);
		},
		TIMEOUT
	);

	it(
		'tells which of several users have it on',
		async () => {
			const { user: on } = await enabledUser();
			const off = await newUser();

			expect(await service.enabledAmong([on.id, off.id])).toEqual(new Set([on.id]));
			expect(await service.enabledAmong([])).toEqual(new Set());
		},
		TIMEOUT
	);

	it(
		'asks a member to set it up only where the organization requires it and they do not have it',
		async () => {
			const member = await newUser();
			const { user: protectedMember } = await enabledUser();

			expect(await service.isRequiredByOrganization(STRICT_ORGANIZATION, TENANT)).toBe(true);
			expect(await service.isRequiredByOrganization(ORGANIZATION, TENANT)).toBe(false);
			expect(
				await service.isRequiredByOrganization(STRICT_ORGANIZATION, '9c000000-0000-4000-8000-0000000000ff')
			).toBe(false);
			expect(await service.isSetupRequired(member.id, STRICT_ORGANIZATION, TENANT)).toBe(true);
			expect(await service.isSetupRequired(member.id, ORGANIZATION, TENANT)).toBe(false);
			expect(await service.isSetupRequired(protectedMember.id, STRICT_ORGANIZATION, TENANT)).toBe(false);
		},
		TIMEOUT
	);
});

describe('UserTwoFactorService races and MikroORM reads', () => {
	const previousKey = process.env.ENCRYPTION_KEY;
	let dataSource: DataSource;
	let service: UserTwoFactorService;
	const USER = { id: '9c000000-0000-4000-8000-0000000000e1', tenantId: TENANT, email: 'race@example.com' };

	beforeAll(async () => {
		process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		await insertRow(dataSource, Tenant, { id: TENANT, name: 'Tenant' });
		await insertRow(dataSource, User, { id: USER.id, tenantId: TENANT, email: USER.email });
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
		if (previousKey === undefined) {
			delete process.env.ENCRYPTION_KEY;
		} else {
			process.env.ENCRYPTION_KEY = previousKey;
		}
	});

	beforeEach(() => {
		const repository = new TypeOrmUserTwoFactorRepository(dataSource.getRepository(UserTwoFactor));
		service = new UserTwoFactorService(
			repository,
			undefined,
			new EncryptionService(),
			new LoginAttemptService(null)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it(
		'does not turn on a secret that an enrolment started again put in place after the code was checked',
		async () => {
			const { secret } = await service.enroll(USER);
			const checker = service as unknown as { acceptCode(row: unknown, code: string): Promise<number | null> };
			const acceptCode = checker.acceptCode.bind(service);
			jest.spyOn(checker, 'acceptCode').mockImplementation(async (row, code) => {
				const step = await acceptCode(row, code);
				// Another session starts the setup again, between the check and the write
				await service.enroll(USER);
				return step;
			});

			expect(await statusOf(service.confirm(USER.id, totpAt(secret, Date.now())))).toBe(HttpStatus.CONFLICT);
			expect(await service.isEnabled(USER.id)).toBe(false);
		},
		TIMEOUT
	);

});
