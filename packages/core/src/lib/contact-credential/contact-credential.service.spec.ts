/**
 * The customer-side login — a contact's credential, not a second user system (schema chapter §7.3).
 *
 * Five rules, and the suite walks each of them: one credential per contact, an address unique per tenant
 * and always stored normalised, a plaintext secret refused rather than ignored, a single-use token that
 * is one fact in two halves and is spent by the redemption that consumes it, and the lockout ladder —
 * armed before the password is checked, and cleared by the success that follows it.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole application
 * graph. The service under test is the real one, over an in-memory table that applies the `where` the
 * service states, so a lookup that stopped scoping itself to the tenant is caught here rather than
 * accommodated.
 */
jest.mock('../core/crud/tenant-aware-crud.service', () => {
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async softDelete(id: any): Promise<any> {
			return this.typeOrmRepository.update(id, { deletedAt: new Date() });
		}
	}

	return { TenantAwareCrudService };
});

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => null,
		currentUserId: () => null,
		currentTenantId: () => '00000000-0000-4000-8000-000000000001',
		currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

import { CONTACT_LOCKOUT_POLICY } from '@gauzy/contracts';
import { ContactCredential } from './contact-credential.entity';
import { ContactCredentialService } from './contact-credential.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000009';
const ORG = '00000000-0000-4000-8000-000000000002';
const CUSTOMER = 'contact-1';
const OTHER_CUSTOMER = 'contact-2';
const CREDENTIAL = 'credential-1';
const HASH = 'argon2id$v=19$m=65536,t=3,p=4$hash';
const NEW_HASH = 'argon2id$v=19$m=65536,t=3,p=4$rotated';
const EMAIL = 'ada@example.com';

const MINUTE = 60 * 1000;

type Row = Record<string, any>;

/**
 * An in-memory stand-in for the table and the repository the service writes through.
 *
 * The `where` the service states is applied, so a lookup that stopped narrowing is caught here.
 */
function world(seed: Row[] = []) {
	const tables: Record<string, Row[]> = { contact_credential: [...seed] };
	let sequence = 0;

	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});

	const save = (row: Row): Row => {
		if (row.id) {
			const index = tables.contact_credential.findIndex((one) => one.id === row.id);

			if (index >= 0) {
				tables.contact_credential[index] = { ...tables.contact_credential[index], ...row };

				return tables.contact_credential[index];
			}
		}

		const created = { id: `credential-${++sequence}`, createdAt: new Date(), ...row };

		tables.contact_credential.push(created);

		return created;
	};

	const repository = {
		manager: { transaction: async (run: (manager: any) => Promise<any>) => run(repository) },
		metadata: { tableName: 'contact_credential', hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => tables.contact_credential.filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) =>
			tables.contact_credential.find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => tables.contact_credential.find((row) => matches(row, where)) ?? null,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => save(row),
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables.contact_credential.findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(tables.contact_credential[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};

	return {
		tables,
		repository,
		service: new ContactCredentialService(repository as never, {} as never),
		credential: (id: string = CREDENTIAL) => tables.contact_credential.find((row) => row.id === id)
	};
}

/** One `contact_credential` row, with the fields this suite reads. */
const credentialRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	customerId: CUSTOMER,
	email: EMAIL,
	passwordHash: HASH,
	isVerified: false,
	failedAttempts: 0,
	...overrides
});

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

describe('ContactCredentialService — one login per contact, one address per tenant', () => {
	it('records a login with the address normalised and no verification claimed', async () => {
		const { service, credential } = world();

		const created = await service.createCredential({
			customerId: CUSTOMER,
			email: '  Ada@Example.COM ',
			passwordHash: HASH
		});

		expect(created.email).toBe(EMAIL);
		expect(created.isVerified).toBe(false);
		expect(created.failedAttempts).toBe(0);
		expect(created.tenantId).toBe(TENANT);
		expect(created.organizationId).toBe(ORG);
		expect(credential(created.id)).toBeDefined();
	});

	it('refuses a body that carries a plaintext password', async () => {
		const { service, tables } = world();

		expect(
			await refusalOf(() =>
				service.createCredential({ customerId: CUSTOMER, email: EMAIL, password: 'correct horse' } as never)
			)
		).toContain('CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED');
		expect(tables.contact_credential).toHaveLength(0);
	});

	it('refuses a create with no hash, because a login with no password is not a login', async () => {
		const { service } = world();

		expect(await refusalOf(() => service.createCredential({ customerId: CUSTOMER, email: EMAIL } as never))).toContain(
			'CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED'
		);
	});

	it('refuses a second credential for one contact', async () => {
		const { service, tables } = world([credentialRow(CREDENTIAL)]);

		expect(
			await refusalOf(() =>
				service.createCredential({ customerId: CUSTOMER, email: 'other@example.com', passwordHash: HASH })
			)
		).toContain('CONTACT_CREDENTIAL_EXISTS');
		expect(tables.contact_credential).toHaveLength(1);
	});

	it('refuses an address another live credential of the tenant holds, whatever its casing', async () => {
		const { service, tables } = world([credentialRow(CREDENTIAL)]);

		expect(
			await refusalOf(() =>
				service.createCredential({ customerId: OTHER_CUSTOMER, email: 'ADA@example.com', passwordHash: HASH })
			)
		).toContain('CONTACT_CREDENTIAL_EMAIL_TAKEN');
		expect(tables.contact_credential).toHaveLength(1);
	});

	it('allows the same address in another tenant, because the rule is per tenant', async () => {
		const { service } = world([credentialRow(CREDENTIAL, { tenantId: OTHER_TENANT })]);

		const created = await service.createCredential({
			customerId: OTHER_CUSTOMER,
			email: EMAIL,
			passwordHash: HASH
		});

		expect(created.email).toBe(EMAIL);
		expect(created.tenantId).toBe(TENANT);
	});

	it('resolves a login by the address in the casing the caller typed', async () => {
		const { service } = world([credentialRow(CREDENTIAL)]);

		const found = await service.findByEmail('  ADA@Example.com ');

		expect(found?.id).toBe(CREDENTIAL);
	});

	it('the credential of one contact is resolved per contact and per scope', async () => {
		const { service } = world([credentialRow(CREDENTIAL)]);

		expect((await service.findCredentialOfCustomer(CUSTOMER))?.id).toBe(CREDENTIAL);
		expect(await service.findCredentialOfCustomer(OTHER_CUSTOMER)).toBeNull();
		expect(await service.findCredential('missing')).toBeNull();
	});

	it('answers a miss with CONTACT_CREDENTIAL_NOT_FOUND rather than an empty row', async () => {
		const { service } = world();

		expect(await refusalOf(() => service.findCredentialOrFail('missing'))).toContain(
			'CONTACT_CREDENTIAL_NOT_FOUND'
		);
	});
});

describe('ContactCredentialService — what a descriptive write may carry', () => {
	it('changes the address and refuses one another live credential holds', async () => {
		const { service } = world([
			credentialRow(CREDENTIAL),
			credentialRow('credential-2', { customerId: OTHER_CUSTOMER, email: 'grace@example.com' })
		]);

		const updated = await service.updateCredential(CREDENTIAL, { email: 'ada.lovelace@example.com' });

		expect(updated.email).toBe('ada.lovelace@example.com');

		expect(await refusalOf(() => service.updateCredential(CREDENTIAL, { email: 'grace@example.com' }))).toContain(
			'CONTACT_CREDENTIAL_EMAIL_TAKEN'
		);
	});

	it('keeps its own address, which is not a change', async () => {
		const { service } = world([credentialRow(CREDENTIAL)]);

		const updated = await service.updateCredential(CREDENTIAL, { email: EMAIL });

		expect(updated.email).toBe(EMAIL);
	});

	it('refuses every secret member on a descriptive write, naming the operation that owns each', async () => {
		const { service } = world([credentialRow(CREDENTIAL)]);

		for (const member of ['passwordHash', 'mfaSecret', 'verificationToken', 'resetToken', 'password']) {
			expect(await refusalOf(() => service.updateCredential(CREDENTIAL, { [member]: 'x' } as never))).toContain(
				'CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED'
			);
		}
	});
});

describe('ContactCredentialService — a single-use token is one fact in two halves', () => {
	it('refuses a verification token stated without its expiry', async () => {
		const { service } = world([credentialRow(CREDENTIAL)]);

		expect(
			await refusalOf(() =>
				service.setVerificationToken(CREDENTIAL, { token: 'hashed-token' } as never)
			)
		).toContain('CONTACT_CREDENTIAL_TOKEN_INVALID');
	});

	it('refuses a verification token whose window has already closed', async () => {
		const { service } = world([credentialRow(CREDENTIAL)]);

		expect(
			await refusalOf(() =>
				service.setVerificationToken(CREDENTIAL, {
					token: 'hashed-token',
					expiresAt: new Date(Date.now() - MINUTE)
				})
			)
		).toContain('CONTACT_CREDENTIAL_TOKEN_INVALID');
	});

	it('confirms the address by consuming the verification token, and refuses the replay', async () => {
		const { service, credential } = world([
			credentialRow(CREDENTIAL, {
				verificationToken: 'hashed-token',
				verificationExpiresAt: new Date(Date.now() + 60 * MINUTE)
			})
		]);

		const verified = await service.verifyEmail(CREDENTIAL, 'hashed-token');

		expect(verified.isVerified).toBe(true);
		expect(credential(CREDENTIAL)?.verificationToken).toBeNull();

		// The token was single use: the second redemption finds nothing outstanding.
		expect(await refusalOf(() => service.verifyEmail(CREDENTIAL, 'hashed-token'))).toContain(
			'CONTACT_CREDENTIAL_TOKEN_INVALID'
		);
	});

	it('refuses a verification token that is not the one the credential issued', async () => {
		const { service } = world([
			credentialRow(CREDENTIAL, {
				verificationToken: 'hashed-token',
				verificationExpiresAt: new Date(Date.now() + 60 * MINUTE)
			})
		]);

		expect(await refusalOf(() => service.verifyEmail(CREDENTIAL, 'another-token'))).toContain(
			'CONTACT_CREDENTIAL_TOKEN_INVALID'
		);
	});

	it('refuses an expired verification token', async () => {
		const { service } = world([
			credentialRow(CREDENTIAL, {
				verificationToken: 'hashed-token',
				verificationExpiresAt: new Date(Date.now() - MINUTE)
			})
		]);

		expect(await refusalOf(() => service.verifyEmail(CREDENTIAL, 'hashed-token'))).toContain(
			'CONTACT_CREDENTIAL_TOKEN_INVALID'
		);
	});

	it('completes a reset by spending its token, rotating the hash and clearing the lockout', async () => {
		const { service, credential } = world([
			credentialRow(CREDENTIAL, {
				resetToken: 'hashed-reset',
				resetExpiresAt: new Date(Date.now() + 30 * MINUTE),
				failedAttempts: 5,
				lockedUntil: new Date(Date.now() + 15 * MINUTE)
			})
		]);

		const reset = await service.completeReset(CREDENTIAL, {
			token: 'hashed-reset',
			expiresAt: new Date(Date.now() + 30 * MINUTE),
			passwordHash: NEW_HASH
		});

		expect(reset.passwordHash).toBe(NEW_HASH);
		expect(reset.failedAttempts).toBe(0);
		expect(reset.lockedUntil).toBeNull();
		expect(credential(CREDENTIAL)?.resetToken).toBeNull();
	});

	it('refuses a reset with no token outstanding and a reset that carries no hash', async () => {
		const { service } = world([credentialRow(CREDENTIAL)]);

		expect(
			await refusalOf(() =>
				service.completeReset(CREDENTIAL, {
					token: 'hashed-reset',
					expiresAt: new Date(Date.now() + MINUTE),
					passwordHash: NEW_HASH
				})
			)
		).toContain('CONTACT_CREDENTIAL_TOKEN_INVALID');

		const withToken = world([
			credentialRow(CREDENTIAL, {
				resetToken: 'hashed-reset',
				resetExpiresAt: new Date(Date.now() + 30 * MINUTE)
			})
		]);

		expect(
			await refusalOf(() =>
				withToken.service.completeReset(CREDENTIAL, {
					token: 'hashed-reset',
					expiresAt: new Date(Date.now() + 30 * MINUTE)
				} as never)
			)
		).toContain('CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED');
	});

	it('refuses an expired reset token', async () => {
		const { service } = world([
			credentialRow(CREDENTIAL, {
				resetToken: 'hashed-reset',
				resetExpiresAt: new Date(Date.now() - MINUTE)
			})
		]);

		expect(
			await refusalOf(() =>
				service.completeReset(CREDENTIAL, {
					token: 'hashed-reset',
					expiresAt: new Date(Date.now() + MINUTE),
					passwordHash: NEW_HASH
				})
			)
		).toContain('CONTACT_CREDENTIAL_TOKEN_INVALID');
	});
});

describe('ContactCredentialService — the lockout ladder', () => {
	it('counts failures without locking below the threshold', async () => {
		const { service } = world([credentialRow(CREDENTIAL)]);

		for (let attempt = 1; attempt <= CONTACT_LOCKOUT_POLICY.threshold - 1; attempt++) {
			await service.registerFailedAttempt(CREDENTIAL);
		}

		const credential = await service.findCredentialOrFail(CREDENTIAL);

		expect(credential.failedAttempts).toBe(CONTACT_LOCKOUT_POLICY.threshold - 1);
		expect(service.isLocked(credential)).toBe(false);
	});

	it('arms a fifteen-minute lock on the fifth consecutive failure', async () => {
		const { service } = world([credentialRow(CREDENTIAL)]);
		const at = new Date('2026-03-01T10:00:00.000Z');

		let credential = credentialRow(CREDENTIAL) as never as Awaited<ReturnType<typeof service.findCredentialOrFail>>;

		for (let attempt = 1; attempt <= CONTACT_LOCKOUT_POLICY.threshold; attempt++) {
			credential = await service.registerFailedAttempt(CREDENTIAL, at);
		}

		expect(credential.failedAttempts).toBe(CONTACT_LOCKOUT_POLICY.threshold);
		expect(new Date(credential.lockedUntil as Date).toISOString()).toBe(
			new Date(at.getTime() + CONTACT_LOCKOUT_POLICY.durationMinutes * MINUTE).toISOString()
		);
	});

	it('extends the lock to thirty minutes when a locked credential is presented again', async () => {
		const armed = new Date('2026-03-01T10:00:00.000Z');
		const { service } = world([
			credentialRow(CREDENTIAL, {
				failedAttempts: CONTACT_LOCKOUT_POLICY.threshold,
				lockedUntil: new Date(armed.getTime() + CONTACT_LOCKOUT_POLICY.durationMinutes * MINUTE)
			})
		]);
		const later = new Date(armed.getTime() + 5 * MINUTE);

		const credential = await service.registerFailedAttempt(CREDENTIAL, later);

		expect(new Date(credential.lockedUntil as Date).toISOString()).toBe(
			new Date(later.getTime() + CONTACT_LOCKOUT_POLICY.extensionMinutes * MINUTE).toISOString()
		);
	});

	it('never sets a lock past its ceiling, however many failures arrive', async () => {
		const at = new Date('2026-03-01T10:00:00.000Z');
		const { service } = world([
			credentialRow(CREDENTIAL, {
				failedAttempts: 40,
				lockedUntil: new Date(at.getTime() + MINUTE)
			})
		]);

		const credential = await service.registerFailedAttempt(CREDENTIAL, at, {
			threshold: 1,
			durationMinutes: 60,
			extensionMinutes: 600,
			maxHours: 1
		});

		expect(new Date(credential.lockedUntil as Date).toISOString()).toBe(
			new Date(at.getTime() + 60 * MINUTE).toISOString()
		);
	});

	it('refuses a login while the lock is armed, whatever the password would be', async () => {
		const at = new Date('2026-03-01T10:00:00.000Z');
		const { service } = world([
			credentialRow(CREDENTIAL, { lockedUntil: new Date(at.getTime() + 15 * MINUTE) })
		]);

		const credential = await service.findCredentialOrFail(CREDENTIAL);

		expect(() => service.assertLoginAllowed(credential, at)).toThrow(/CONTACT_CREDENTIAL_LOCKED/);
		expect(() => service.assertLoginAllowed(credential, new Date(at.getTime() + 16 * MINUTE))).not.toThrow();
	});

	it('clears the counter and the lock on a successful login', async () => {
		const at = new Date('2026-03-01T10:00:00.000Z');
		const { service } = world([
			credentialRow(CREDENTIAL, {
				failedAttempts: 4,
				lockedUntil: new Date(at.getTime() + 15 * MINUTE)
			})
		]);

		const credential = await service.recordSuccessfulLogin(CREDENTIAL, at);

		expect(credential.failedAttempts).toBe(0);
		expect(credential.lockedUntil).toBeNull();
		expect(credential.lastLoginAt).toBeInstanceOf(Date);
		expect(service.isLocked(credential, at)).toBe(false);
	});
});

describe('ContactCredentialService — the secrets never leave the service', () => {
	it('answers a projection with no member for any secret', async () => {
		const { service } = world([
			credentialRow(CREDENTIAL, { mfaSecret: 'encrypted-secret', verificationToken: 'hashed-token' })
		]);

		const credential = await service.findCredentialOrFail(CREDENTIAL);
		const projection = service.toPublicCredential(credential);

		for (const secret of ['passwordHash', 'mfaSecret', 'verificationToken', 'resetToken']) {
			expect(Object.prototype.hasOwnProperty.call(projection, secret)).toBe(false);
		}

		expect(projection.email).toBe(EMAIL);
		expect(projection.hasMfa).toBe(true);
	});

	it('enrols and clears an authenticator factor', async () => {
		const { service } = world([credentialRow(CREDENTIAL)]);

		const enrolled = await service.setMfaSecret(CREDENTIAL, 'encrypted-secret');
		expect(enrolled.mfaSecret).toBe('encrypted-secret');

		const cleared = await service.clearMfaSecret(CREDENTIAL);
		expect(cleared.mfaSecret).toBeNull();

		expect(await refusalOf(() => service.setMfaSecret(CREDENTIAL, '   '))).toContain(
			'CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED'
		);
	});

	it('soft-deletes a credential, which is the only removal path there is', async () => {
		const { service, credential } = world([credentialRow(CREDENTIAL)]);

		await service.removeCredential(CREDENTIAL);

		expect(credential(CREDENTIAL)?.deletedAt).toBeInstanceOf(Date);
	});
});
