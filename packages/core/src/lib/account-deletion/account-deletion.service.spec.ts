// cspell:ignore elodie
jest.mock('@gauzy/config', () => ({
	environment: {
		demo: false,
		clientBaseUrl: 'https://app.gauzy.co',
		appIntegrationConfig: { appName: 'Gauzy', appLink: 'https://app.gauzy.co' }
	}
}));
jest.mock('../core/entities/internal', () => ({
	ImageAsset: class ImageAsset {},
	Tenant: class Tenant {},
	User: class User {},
	UserOrganization: class {}
}));
jest.mock('../email-send/email.service', () => ({ EmailService: class EmailService {} }));
jest.mock('../auth/strategies/authenticated-user-cache', () => ({ AuthenticatedUserCache: class {} }));
jest.mock('../shared/billing/stripe-subscription.service', () => ({ StripeSubscriptionService: class {} }));
jest.mock('../user/user-authorship', () => ({
	detachUserReferences: jest.fn().mockResolvedValue(0),
	detachEmployeeReferences: jest.fn().mockResolvedValue(0),
	lockRowForUpdate: jest.fn().mockResolvedValue(true),
	sqlPlaceholder: () => '$1'
}));
jest.mock('./account-deletion-files', () => ({
	collectStoredFiles: jest.fn().mockResolvedValue([]),
	deleteStoredFiles: jest.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
	deleteUnusedRows: jest.fn().mockResolvedValue(0),
	isImageAssetShared: jest.fn().mockResolvedValue(false),
	loadTenantSettings: jest.fn().mockResolvedValue({}),
	onlyFilesOfTenant: jest.fn((files) => files)
}));
jest.mock('./account-deletion-request.entity', () => ({ AccountDeletionRequest: class AccountDeletionRequest {} }));
jest.mock('./repository/type-orm-account-deletion-request.repository', () => ({
	TypeOrmAccountDeletionRequestRepository: class {}
}));

import { ConflictException, GoneException } from '@nestjs/common';
import { AccountDeletionOutcomeEnum } from '@gauzy/contracts';
import {
	ACCOUNT_DELETION_EMAIL_MAX_CHARACTERS,
	ACCOUNT_DELETION_INVALID_LINK_MESSAGE,
	ACCOUNT_DELETION_PARTIAL_MESSAGE,
	AccountDeletionService,
	accountDeletionEmailPatterns,
	outcomeFor,
	planHashOf
} from './account-deletion.service';
import {
	generateAccountDeletionToken,
	hashAccountDeletionToken,
	normalizeAccountDeletionEmail
} from './account-deletion-token';

function queryBuilder() {
	const builder: any = {};
	for (const method of ['update', 'insert', 'into', 'values', 'set', 'where', 'andWhere', 'callListeners']) {
		builder[method] = jest.fn().mockReturnValue(builder);
	}
	builder.execute = jest.fn().mockResolvedValue({ affected: 1, identifiers: [{ id: 'audit-1' }] });
	return builder;
}

function setup() {
	const builder = queryBuilder();
	const repository = {
		count: jest.fn().mockResolvedValue(0),
		create: jest.fn((value) => value),
		save: jest.fn(async (value) => ({ id: 'r1', ...value })),
		findOneBy: jest.fn(),
		createQueryBuilder: jest.fn(() => builder)
	};
	const transactionManager = {
		getRepository: jest.fn(() => repository),
		query: jest.fn().mockResolvedValue([]),
		connection: { driver: { options: { type: 'postgres' } } }
	};
	const dataSource = {
		manager: {},
		driver: { options: { type: 'postgres' } },
		transaction: jest.fn(async (work) => work(transactionManager))
	};
	const emailService = {
		sendAccountDeletionLink: jest.fn().mockResolvedValue(undefined),
		sendAccountDeletionCompleted: jest.fn().mockResolvedValue(undefined)
	};
	const cache = { forget: jest.fn() };
	const service = new AccountDeletionService(repository as any, dataSource as any, emailService as any, cache as any);
	const findUsers = jest.spyOn(service as any, 'findUsersByEmail');
	const plan = jest.spyOn(service as any, 'plan');
	const erase = jest.spyOn(service as any, 'eraseAccount');
	jest.spyOn(service as any, 'scrubStaleAddresses').mockResolvedValue(undefined);
	return { service, repository, builder, transactionManager, emailService, findUsers, plan, erase };
}

const user = { id: 'u1', tenantId: 't1', preferredLanguage: 'en' };
const planned = [
	{ user: { id: 'u1', tenantId: 't1' }, account: { outcome: AccountDeletionOutcomeEnum.WORKSPACE_DELETED } },
	{ user: { id: 'u2', tenantId: 't2' }, account: { outcome: AccountDeletionOutcomeEnum.ACCOUNT_REMOVED } }
];
const erased = (workspacesDeleted: number) => ({
	accounts: 1,
	workspacesDeleted,
	filesDeleted: 2,
	filesFailed: 0,
	subscriptionsCancelled: 0
});

describe('AccountDeletionService', () => {
	describe('planHashOf', () => {
		it('depends on the accounts and outcomes, not on their order, and reveals no id', () => {
			const hash = planHashOf(planned as any);
			expect(planHashOf([...planned].reverse() as any)).toBe(hash);
			expect(hash).toMatch(/^[0-9a-f]{32}$/);
			expect(hash).not.toContain('u1');
			const changed = [planned[0], { ...planned[1], account: { outcome: AccountDeletionOutcomeEnum.WORKSPACE_DELETED } }];
			expect(planHashOf(changed as any)).not.toBe(hash);
			const lastAdmin = [planned[0], { ...planned[1], account: { ...planned[1].account, soleAdmin: true } }];
			expect(planHashOf(lastAdmin as any)).not.toBe(hash);
		});
	});

	describe('findUsersByEmail', () => {
		/** A manager whose user query records its condition and answers `rows`. */
		const recording = (rows: Array<{ id: string; email: string }>) => {
			const recorded: { sql?: string; params?: Record<string, unknown> } = {};
			const builder: any = {};
			for (const method of ['withDeleted', 'leftJoinAndSelect', 'orderBy']) {
				builder[method] = jest.fn(() => builder);
			}
			builder.where = jest.fn((sql: string, params: Record<string, unknown>) => {
				Object.assign(recorded, { sql, params });
				return builder;
			});
			builder.getMany = jest.fn(async () => rows);
			return { manager: { getRepository: () => ({ createQueryBuilder: () => builder }) }, recorded };
		};

		it('matches an ASCII address in SQL, as it is', async () => {
			const { service } = setup();
			const rows = [{ id: 'u1', email: 'Ada@Example.com' }];
			const { manager, recorded } = recording(rows);

			await expect((service as any).findUsersByEmail(manager, 'ada@example.com')).resolves.toBe(rows);
			expect(recorded).toEqual({ sql: 'LOWER(TRIM(user.email)) = :email', params: { email: 'ada@example.com' } });
		});

		// SQLite's LOWER leaves `É` as it is (so does Postgres under the C collation), while the address was
		// lowercased by JavaScript: an equality in SQL never matched such an account.
		it('matches an address with non-ASCII letters the way the address itself was lowercased', async () => {
			const { service } = setup();
			const { manager, recorded } = recording([
				{ id: 'u1', email: ' Élodie@Example.com ' },
				{ id: 'u2', email: 'xlodie@example.com' }
			]);

			const users = await (service as any).findUsersByEmail(manager, 'élodie@example.com');

			expect(users.map(({ id }: { id: string }) => id)).toEqual(['u1']);
			expect(recorded).toEqual({
				sql: "(LOWER(TRIM(user.email)) LIKE :pattern0 ESCAPE '!')",
				params: { pattern0: '_lodie@example.com' }
			});
		});

		it('narrows to addresses of the same length and the same ASCII characters', () => {
			// Each non-ASCII letter, and `k` (the Kelvin sign lowercases to it), stands for any one letter
			expect(accountDeletionEmailPatterns('élodie@example.com')).toEqual(['_lodie@example.com']);
			expect(accountDeletionEmailPatterns('jörg.k@example.com')).toEqual(['j_rg._@example.com']);
			// `İ` lowercases to two letters: stored as the one capital, or as the two of its decomposed spelling
			expect(accountDeletionEmailPatterns('i\u0307pek@example.com')).toEqual([
				'_pe_@example.com',
				'i_pe_@example.com'
			]);
			// The address's own `%`, `_` and `!` are characters, not wildcards: no address widens it to a domain
			expect(accountDeletionEmailPatterns('%é_!@example.com')).toEqual(['!%_!_!!@example.com']);
		});

		it('builds no pattern for an empty address or one longer than any request can carry', () => {
			expect(accountDeletionEmailPatterns('')).toEqual([]);
			// 254 capital dotted I's (the DTO's limit) lowercase to 508 characters: still a pattern
			const longest = 'İ'.repeat(254).toLowerCase();
			expect(Array.from(longest)).toHaveLength(508);
			expect(accountDeletionEmailPatterns(longest)).toHaveLength(2);
			expect(accountDeletionEmailPatterns('é'.repeat(ACCOUNT_DELETION_EMAIL_MAX_CHARACTERS + 1))).toEqual([]);
		});

		// On a real SQLite table, the condition findUsersByEmail sends and the comparison it makes of the rows.
		it('finds every stored spelling on SQLite, and nothing an address with wildcards would widen to', () => {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const Database = require('better-sqlite3');
			const db = new Database(':memory:');
			try {
				db.exec('CREATE TABLE "user" ("id" TEXT, "email" TEXT)');
				const insert = db.prepare('INSERT INTO "user" ("id", "email") VALUES (?, ?)');
				for (const [id, email] of [
					['elodie', ' Élodie@Example.com '],
					['other', 'xlodie@example.com'],
					['dotted', 'İpek@example.com'],
					['decomposed', 'I\u0307pek@example.com'],
					['plain', 'IPEK@example.com'],
					['ada', 'ada@example.com'],
					['bo', 'bo@example.com']
				]) {
					insert.run(id, email);
				}
				/** The rows SQL hands back for the address, and those of them the exact comparison keeps. */
				const find = (address: string) => {
					const email = normalizeAccountDeletionEmail(address);
					const patterns = accountDeletionEmailPatterns(email);
					const condition = patterns.map(() => `LOWER(TRIM("email")) LIKE ? ESCAPE '!'`).join(' OR ');
					const rows: Array<{ id: string; email: string }> = db
						.prepare(`SELECT "id", "email" FROM "user" WHERE ${condition} ORDER BY "id"`)
						.all(...patterns);
					return {
						candidates: rows.map(({ id }) => id),
						found: rows
							.filter((row) => normalizeAccountDeletionEmail(row.email) === email)
							.map(({ id }) => id)
					};
				};

				// SQLite's LOWER keeps the non-ASCII capitals, so an equality in SQL found only the decomposed spelling,
				// whose capital is an ASCII `I`
				expect(
					db
						.prepare('SELECT "id" FROM "user" WHERE LOWER(TRIM("email")) IN (?, ?)')
						.all('élodie@example.com', 'i\u0307pek@example.com')
				).toEqual([{ id: 'decomposed' }]);
				expect(find('élodie@example.com').found).toEqual(['elodie']);
				// `İ` lowercases to `i` and a combining dot: both stored spellings are the same address
				expect(find('İpek@example.com').found).toEqual(['decomposed', 'dotted']);
				// `%` is a character of the address: no account of the domain is even read
				expect(find('%é@example.com')).toEqual({ candidates: [], found: [] });
			} finally {
				db.close();
			}
		});
	});

	describe('request', () => {
		it('does nothing visible for an address without accounts', async () => {
			const { service, findUsers, repository, emailService } = setup();
			findUsers.mockResolvedValue([]);

			await service.request({ email: 'nobody@ever.co' });

			expect(repository.save).not.toHaveBeenCalled();
			expect(emailService.sendAccountDeletionLink).not.toHaveBeenCalled();
		});

		it('locks the address, revokes the live link (clearing its address), stores only the token hash', async () => {
			const { service, findUsers, repository, builder, transactionManager, emailService } = setup();
			findUsers.mockResolvedValue([user]);
			// The address and client-address digests are keyed with the deployment's secret.
			const previousKey = process.env['ENCRYPTION_KEY'];
			process.env['ENCRYPTION_KEY'] = 'a-deployment-encryption-key-1';

			try {
				await service.request({ email: ' Jane@Ever.co ', callbackUrl: 'https://evil.example/steal' }, { ip: '1.2.3.4' });
			} finally {
				if (previousKey === undefined) {
					delete process.env['ENCRYPTION_KEY'];
				} else {
					process.env['ENCRYPTION_KEY'] = previousKey;
				}
			}

			// The lock is named by the unkeyed digest of the address, whatever secret the instance holds, so two
			// instances that briefly hold different secrets still serialise on the same name.
			const unkeyed = require('node:crypto').createHash('sha256').update('jane@ever.co', 'utf8').digest('hex');
			expect(transactionManager.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [
				`account-deletion:${unkeyed}`
			]);
			// The limit and the revocation also find the address's rows by the clear address a live request keeps,
			// which a replaced secret does not change.
			expect(repository.count).toHaveBeenCalledWith({
				where: expect.arrayContaining([expect.objectContaining({ email: 'jane@ever.co' })])
			});
			expect(builder.where).toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ email: 'jane@ever.co', completedAt: expect.anything() })])
			);
			expect(builder.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date), email: null });
			const stored = repository.save.mock.calls[0][0];
			expect(stored.email).toBe('jane@ever.co');
			expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
			expect(stored.requestIpHash).toMatch(/^[0-9a-f]{64}$/);
			expect(stored.requestIpHash).not.toContain('1.2.3.4');

			const { deletionLink } = emailService.sendAccountDeletionLink.mock.calls[0][0];
			// The caller's link points at a foreign origin, so the deployment's own page is used.
			expect(deletionLink).toMatch(/^https:\/\/app\.gauzy\.co\/#\/auth\/delete-account\/confirm\?token=[A-Za-z0-9_-]{43}$/);
			expect(hashAccountDeletionToken(decodeURIComponent(deletionLink.split('token=')[1]))).toBe(stored.tokenHash);
		});

		it('drops requests past the per-address limit (counted under the lock)', async () => {
			const { service, findUsers, repository, emailService } = setup();
			repository.count.mockResolvedValue(3);
			findUsers.mockResolvedValue([user]);

			await service.request({ email: 'jane@ever.co' });

			expect(repository.save).not.toHaveBeenCalled();
			expect(emailService.sendAccountDeletionLink).not.toHaveBeenCalled();
		});

		it('never throws, whatever fails', async () => {
			const { service, findUsers } = setup();
			findUsers.mockRejectedValue(new Error('db down'));

			await expect(service.request({ email: 'jane@ever.co' })).resolves.toBeUndefined();
		});
	});

	describe('preview', () => {
		it('answers the same 410 for malformed, unknown and still-claimed tokens', async () => {
			const { service, repository } = setup();
			const gone = new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE);

			await expect(service.preview('nope')).rejects.toThrow(gone);
			repository.findOneBy.mockResolvedValueOnce(null);
			await expect(service.preview(generateAccountDeletionToken())).rejects.toThrow(gone);
			repository.findOneBy.mockResolvedValueOnce({ id: 'r1', email: 'jane@ever.co', usedAt: new Date() });
			await expect(service.preview(generateAccountDeletionToken())).rejects.toThrow(gone);
		});

		it('returns the planHash the confirm must send back', async () => {
			const { service, repository, plan } = setup();
			repository.findOneBy.mockResolvedValue({ id: 'r1', email: 'jane@ever.co', expiresAt: new Date() });
			plan.mockResolvedValue(planned);

			const preview = await service.preview(generateAccountDeletionToken());

			expect(preview.planHash).toBe(planHashOf(planned as any));
			expect(preview.email).toBe('j***@ever.co');
		});
	});

	describe('confirm', () => {
		const live = { id: 'r1', email: 'jane@ever.co', emailHash: 'h', locale: 'en', expiresAt: new Date() };

		it('refuses with 409 and claims nothing when what would be deleted changed since the preview', async () => {
			const { service, repository, plan, builder, erase } = setup();
			repository.findOneBy.mockResolvedValue(live);
			plan.mockResolvedValue(planned);

			await expect(service.confirm(generateAccountDeletionToken(), 'stale-hash')).rejects.toBeInstanceOf(
				ConflictException
			);
			expect(builder.execute).not.toHaveBeenCalled();
			expect(erase).not.toHaveBeenCalled();
		});

		it('answers 410 when another confirm holds the claim', async () => {
			const { service, repository, plan, builder, erase } = setup();
			repository.findOneBy.mockResolvedValue(live);
			plan.mockResolvedValue(planned);
			builder.execute.mockResolvedValueOnce({ affected: 0 });

			await expect(service.confirm(generateAccountDeletionToken(), planHashOf(planned as any))).rejects.toBeInstanceOf(
				GoneException
			);
			expect(erase).not.toHaveBeenCalled();
		});

		it('deletes every account, completes the audit row without the address, and emails a confirmation', async () => {
			const { service, repository, plan, erase, builder, emailService } = setup();
			repository.findOneBy.mockResolvedValue(live);
			plan.mockResolvedValue(planned);
			erase.mockResolvedValueOnce(erased(1)).mockResolvedValueOnce(erased(0));

			const result = await service.confirm(generateAccountDeletionToken(), planHashOf(planned as any));

			expect(result).toEqual({ deleted: true, accounts: 2, workspacesDeleted: 1 });
			expect(builder.set).toHaveBeenCalledWith(expect.objectContaining({ email: null, completedAt: expect.any(Date) }));
			expect(builder.callListeners).toHaveBeenCalledWith(false);
			expect(emailService.sendAccountDeletionCompleted).toHaveBeenCalledWith(
				expect.objectContaining({ email: 'jane@ever.co', accounts: 2, workspacesDeleted: 1, allAccounts: true })
			);
		});

		it('adds to the counts of an earlier, interrupted attempt', async () => {
			const { service, repository, plan, erase } = setup();
			repository.findOneBy.mockResolvedValue({ ...live, result: JSON.stringify({ accounts: 1, workspacesDeleted: 1 }) });
			plan.mockResolvedValue([planned[1]]);
			erase.mockResolvedValueOnce(erased(0));

			const result = await service.confirm(generateAccountDeletionToken(), planHashOf([planned[1]] as any));

			expect(result).toEqual({ deleted: true, accounts: 2, workspacesDeleted: 1 });
		});

		it('says so when an account changed after others were already deleted', async () => {
			const { service, repository, plan, erase } = setup();
			repository.findOneBy.mockResolvedValue(live);
			plan.mockResolvedValue(planned);
			erase.mockResolvedValueOnce(erased(1)).mockRejectedValueOnce(new ConflictException('changed'));

			await expect(service.confirm(generateAccountDeletionToken(), planHashOf(planned as any))).rejects.toThrow(
				ACCOUNT_DELETION_PARTIAL_MESSAGE
			);
		});

		it('stops when another confirm took the claim over (renewal hits nothing)', async () => {
			const { service, repository, plan, erase, builder, emailService } = setup();
			repository.findOneBy.mockResolvedValue(live);
			plan.mockResolvedValue([planned[0]]);
			erase.mockResolvedValueOnce(erased(1));
			builder.execute
				.mockResolvedValueOnce({ affected: 1 }) // the claim
				.mockResolvedValueOnce({ affected: 0 }); // the renewal: lost

			await expect(service.confirm(generateAccountDeletionToken(), planHashOf([planned[0]] as any))).rejects.toBeInstanceOf(
				GoneException
			);
			expect(emailService.sendAccountDeletionCompleted).not.toHaveBeenCalled();
		});

		it('releases the claim when an account fails, so the user can retry', async () => {
			const { service, repository, plan, erase, builder } = setup();
			repository.findOneBy.mockResolvedValue(live);
			plan.mockResolvedValue(planned);
			erase.mockRejectedValueOnce(new ConflictException('changed'));

			await expect(service.confirm(generateAccountDeletionToken(), planHashOf(planned as any))).rejects.toBeInstanceOf(
				ConflictException
			);
			expect(builder.set).toHaveBeenLastCalledWith({ usedAt: null, claimId: null });
		});
	});
});

describe('outcomeFor: who may delete a whole workspace', () => {
	const account = (role: string | null, tenantId: string | null = 't1') => ({ tenantId, role: role ? { name: role } : null });

	it.each(['SUPER_ADMIN', 'ADMIN'])('deletes the whole workspace of its last member when they are %s', (role) => {
		expect(outcomeFor(account(role), 0)).toBe(AccountDeletionOutcomeEnum.WORKSPACE_DELETED);
	});

	it.each(['EMPLOYEE', 'MANAGER', 'VIEWER', 'DATA_ENTRY', 'CANDIDATE', null])(
		'removes only the account of a last member who is %s: the company keeps its workspace and records',
		(role) => {
			expect(outcomeFor(account(role), 0)).toBe(AccountDeletionOutcomeEnum.ACCOUNT_REMOVED);
		}
	);

	it('removes only the account while anyone else (a soft-deleted member included) is in the workspace', () => {
		expect(outcomeFor(account('SUPER_ADMIN'), 1)).toBe(AccountDeletionOutcomeEnum.ACCOUNT_REMOVED);
	});

	it('removes only the account of a user without a workspace', () => {
		expect(outcomeFor(account('SUPER_ADMIN', null), 0)).toBe(AccountDeletionOutcomeEnum.ACCOUNT_REMOVED);
	});
});

describe('the confirmation link in the deletion email', () => {
	const saved = process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
	afterEach(() => {
		if (saved === undefined) delete process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
		else process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = saved;
	});
	const confirmUrl = (callbackUrl?: string) => (setup().service as any).confirmUrl(callbackUrl);

	it('follows a callbackUrl on an origin the deployment lists', () => {
		process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = 'https://app.ever.team';
		expect(confirmUrl('https://app.ever.team/delete/confirm')).toBe('https://app.ever.team/delete/confirm');
	});

	it('ignores EMAIL_LINK_ALLOWED_ORIGINS=*: the token must not go to whatever site the caller names', () => {
		process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = '*';
		expect(confirmUrl('https://attacker.example/steal')).toBe('https://app.gauzy.co/#/auth/delete-account/confirm');
	});
});
