import { DataSource, EntitySchema, Repository } from 'typeorm';
import { InviteStatusEnum } from '@gauzy/contracts';
import {
	emailVerificationClaimWhere,
	inviteClaimWhere,
	inviteReleaseWhere,
	magicCodeClaimWhere,
	passwordResetConsumeWhere
} from './claim-criteria';

/**
 * Regression suite for single-use token consumption.
 *
 * These are the criteria the production services actually run — imported, not re-declared — so
 * dropping a guard from a WHERE clause fails here rather than in the wild. Each claim is exercised
 * against a real better-sqlite3 database, which is the default DB_TYPE and the one where
 * `SELECT ... FOR UPDATE` is unavailable, making the single-statement claim the only defense.
 *
 * Every "the fix works" test is paired with a CONTROL running the pre-fix shape, so a green run
 * means the suite can actually distinguish the two rather than passing vacuously.
 *
 * Background: two parallel password-reset requests carrying one token both changed the password
 * and both returned 200, because the token was only invalidated AFTER the change.
 */

const PasswordResetSchema = new EntitySchema({
	name: 'PasswordReset',
	tableName: 'password_reset',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		email: { type: 'varchar' },
		token: { type: 'text' }
	}
});

const UserSchema = new EntitySchema({
	name: 'User',
	tableName: 'user',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		email: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		code: { type: 'varchar', nullable: true },
		codeExpireAt: { type: 'datetime', nullable: true }
	}
});

const InviteSchema = new EntitySchema({
	name: 'Invite',
	tableName: 'invite',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		email: { type: 'varchar' },
		status: { type: 'varchar' },
		userId: { type: 'varchar', nullable: true }
	}
});

describe('single-use claim criteria', () => {
	let dataSource: DataSource;
	let resets: Repository<any>;
	let users: Repository<any>;
	let invites: Repository<any>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [PasswordResetSchema, UserSchema, InviteSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		resets = dataSource.getRepository('PasswordReset');
		users = dataSource.getRepository('User');
		invites = dataSource.getRepository('Invite');
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	const future = () => new Date(Date.now() + 60_000);
	const past = () => new Date(Date.now() - 60_000);

	describe('password reset — conditional DELETE by primary key', () => {
		it('admits exactly one of two concurrent consumers', async () => {
			const row = await resets.save({ email: 'victim@ever.co', token: 'tok-1' });

			const consume = async () => {
				const { affected } = await resets.delete(passwordResetConsumeWhere(row.id));
				return affected === 1; // the exact test AuthService.consumePasswordResetToken makes
			};
			const winners = (await Promise.all([consume(), consume()])).filter(Boolean);

			expect(winners).toHaveLength(1);
		});

		it('reports a real row count on better-sqlite3, not null or undefined', async () => {
			const row = await resets.save({ email: 'a@ever.co', token: 'tok-2' });

			// The whole gate rests on `affected` being a number here. TypeORM types it
			// `number | null` because exotic drivers do not populate it.
			const { affected } = await resets.delete(passwordResetConsumeWhere(row.id));

			expect(typeof affected).toBe('number');
			expect(affected).toBe(1);
		});

		it('reports 0 for an already-consumed token rather than succeeding', async () => {
			const row = await resets.save({ email: 'b@ever.co', token: 'tok-3' });
			await resets.delete(passwordResetConsumeWhere(row.id));

			const { affected } = await resets.delete(passwordResetConsumeWhere(row.id));

			expect(affected).toBe(0);
		});

		it('CONTROL: consuming only after the side effect lets BOTH requests through', async () => {
			const row = await resets.save({ email: 'c@ever.co', token: 'tok-4' });
			const passwordWrites: string[] = [];

			// The pre-fix ordering: read, act, then invalidate.
			const oldFlow = async (newPassword: string) => {
				const found = await resets.findOne({ where: { token: 'tok-4' } });
				if (!found) throw new Error('invalid token');
				passwordWrites.push(newPassword);
				await resets.delete({ id: row.id });
				return true;
			};
			const settled = await Promise.allSettled([oldFlow('AttackerPass1!'), oldFlow('AttackerPass2!')]);

			expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(2);
			expect(passwordWrites).toEqual(['AttackerPass1!', 'AttackerPass2!']);
		});
	});

	describe('magic sign-in code — conditional UPDATE keyed on the code', () => {
		it('admits exactly one of two concurrent claims', async () => {
			await users.save({ email: 'magic@ever.co', tenantId: 'T1', code: 'MAGIC1', codeExpireAt: future() });

			const claim = async () => {
				const { affected } = await users.update(magicCodeClaimWhere('magic@ever.co', 'MAGIC1'), {
					code: null,
					codeExpireAt: null
				});
				return affected ?? 0;
			};
			const claims = await Promise.all([claim(), claim()]);

			expect(claims.filter((n) => n > 0)).toHaveLength(1);
		});

		it('claims every tenant row sharing the email and code', async () => {
			// One address can exist in several tenants, so a winning claim covers more than one row.
			await users.save({ email: 'multi@ever.co', tenantId: 'T1', code: 'M2', codeExpireAt: future() });
			await users.save({ email: 'multi@ever.co', tenantId: 'T2', code: 'M2', codeExpireAt: future() });

			const { affected } = await users.update(magicCodeClaimWhere('multi@ever.co', 'M2'), {
				code: null,
				codeExpireAt: null
			});

			expect(affected).toBe(2);
		});

		it('keeps the code in the criteria, so a consumed code matches nothing', async () => {
			expect(magicCodeClaimWhere('x@ever.co', 'CODE')).toHaveProperty('code', 'CODE');
		});
	});

	describe('email verification code — id + code + tenant + expiry', () => {
		it('admits exactly one of two concurrent claims', async () => {
			const u = await users.save({ email: 'v@ever.co', tenantId: 'T1', code: 'C1', codeExpireAt: future() });

			const claim = async () => {
				const { affected } = await users.update(emailVerificationClaimWhere(u.id, 'C1', 'T1', new Date()), {
					code: null,
					codeExpireAt: null
				});
				return affected ?? 0;
			};
			const claims = await Promise.all([claim(), claim()]);

			expect(claims.filter((n) => n > 0)).toHaveLength(1);
		});

		it('refuses an expired code', async () => {
			// Closes the window where the lookup and the claim straddle the expiry boundary.
			const u = await users.save({ email: 'exp@ever.co', tenantId: 'T1', code: 'C2', codeExpireAt: past() });

			const { affected } = await users.update(emailVerificationClaimWhere(u.id, 'C2', 'T1', new Date()), {
				code: null,
				codeExpireAt: null
			});

			expect(affected).toBe(0);
		});

		it('refuses a code belonging to another tenant', async () => {
			const u = await users.save({ email: 't@ever.co', tenantId: 'T1', code: 'C3', codeExpireAt: future() });

			const wrong = await users.update(emailVerificationClaimWhere(u.id, 'C3', 'T2', new Date()), { code: null });
			const right = await users.update(emailVerificationClaimWhere(u.id, 'C3', 'T1', new Date()), { code: null });

			expect(wrong.affected).toBe(0);
			expect(right.affected).toBe(1);
		});

		it('refuses a wrong code', async () => {
			const u = await users.save({ email: 'w@ever.co', tenantId: 'T1', code: 'C4', codeExpireAt: future() });

			const { affected } = await users.update(emailVerificationClaimWhere(u.id, 'NOPE', 'T1', new Date()), {
				code: null
			});

			expect(affected).toBe(0);
		});

		it('CONTROL: scoping by id alone lets BOTH requests through', async () => {
			// This is precisely what the code did while its comment claimed otherwise.
			const u = await users.save({ email: 'old@ever.co', tenantId: 'T1', code: 'C5', codeExpireAt: future() });

			const claimIdOnly = async () => {
				const { affected } = await users.update({ id: u.id }, { code: null, codeExpireAt: null });
				return affected ?? 0;
			};
			const claims = await Promise.all([claimIdOnly(), claimIdOnly()]);

			expect(claims.filter((n) => n > 0)).toHaveLength(2);
		});
	});

	describe('invite acceptance — INVITED -> ACCEPTED guard', () => {
		it('admits exactly one of two concurrent acceptances', async () => {
			const inv = await invites.save({ email: 'i@ever.co', status: InviteStatusEnum.INVITED });

			const claim = async () => {
				const { affected } = await invites.update(inviteClaimWhere(inv.id), {
					status: InviteStatusEnum.ACCEPTED
				});
				return (affected ?? 0) > 0;
			};
			const winners = (await Promise.all([claim(), claim()])).filter(Boolean);

			expect(winners).toHaveLength(1);
		});

		it('releases a claimed invite back to INVITED so it can be retried', async () => {
			const inv = await invites.save({ email: 'r@ever.co', status: InviteStatusEnum.INVITED });
			await invites.update(inviteClaimWhere(inv.id), { status: InviteStatusEnum.ACCEPTED });

			const released = await invites.update(inviteReleaseWhere(inv.id), {
				status: InviteStatusEnum.INVITED,
				userId: null
			});
			const reclaimed = await invites.update(inviteClaimWhere(inv.id), { status: InviteStatusEnum.ACCEPTED });

			expect(released.affected).toBe(1);
			expect(reclaimed.affected).toBe(1);
		});

		it('does not resurrect an invite that was rejected or expired by another path', async () => {
			const inv = await invites.save({ email: 'x@ever.co', status: InviteStatusEnum.REJECTED });

			const { affected } = await invites.update(inviteReleaseWhere(inv.id), {
				status: InviteStatusEnum.INVITED
			});

			expect(affected).toBe(0);
		});

		it('CONTROL: flipping status by id alone lets BOTH acceptances through', async () => {
			const inv = await invites.save({ email: 'ctl@ever.co', status: InviteStatusEnum.INVITED });

			const claimIdOnly = async () => {
				const { affected } = await invites.update({ id: inv.id }, { status: InviteStatusEnum.ACCEPTED });
				return (affected ?? 0) > 0;
			};
			const winners = (await Promise.all([claimIdOnly(), claimIdOnly()])).filter(Boolean);

			expect(winners).toHaveLength(2);
		});
	});
});
