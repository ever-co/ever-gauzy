import 'reflect-metadata';
import { Column, DataSource, Entity, JoinColumn, ManyToOne, PrimaryColumn, RelationId, Repository } from 'typeorm';
import { extractRoleIds, normalizeRolePayload } from './role-assignment.helper';

/**
 * GHSA-x4mv-fhwj-g3rp — "the role that is checked is the role that is persisted".
 *
 * The fixtures mirror `User`'s real TypeORM mapping: a `role` many-to-one relation whose join column
 * is `roleId`, plus `roleId` declared again as an explicit `@RelationId` + `@Column` (what
 * `@MultiORMColumn({ relationId: true })` emits). Saving goes through a real better-sqlite3 database,
 * so the assertions are about what TypeORM actually writes, not about what we think it writes.
 *
 * The CONTROL arm shows the pre-fix gap: the old check read `[role?.id, roleId]`, so a bare-string
 * `role` (and a `null` one) was checked as nothing while it still rewrote the stored FK; and when a
 * `role: { id }` sits next to a different `roleId`, TypeORM stores the RELATION — so a check that
 * picks either one alone is wrong. After `normalizeRolePayload`, every shape either stores exactly
 * the checked id or is refused.
 */
@Entity('role_payload_role')
class FixtureRole {
	@PrimaryColumn('varchar')
	id: string;

	@Column('varchar')
	name: string;
}

@Entity('role_payload_user')
class FixtureUser {
	@PrimaryColumn('varchar')
	id: string;

	@Column('varchar')
	email: string;

	@ManyToOne(() => FixtureRole, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	role?: FixtureRole | string;

	@RelationId((it: FixtureUser) => it.role)
	@Column({ nullable: true })
	roleId?: string;
}

describe('role payload persistence (GHSA-x4mv-fhwj-g3rp)', () => {
	const EMP = 'role-employee';
	const SA = 'role-super-admin';
	const USER_ID = 'user-1';

	let dataSource: DataSource;
	let users: Repository<FixtureUser>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [FixtureRole, FixtureUser],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		await dataSource.getRepository(FixtureRole).save([
			{ id: EMP, name: 'EMPLOYEE' },
			{ id: SA, name: 'SUPER_ADMIN' }
		]);
		users = dataSource.getRepository(FixtureUser);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	/** Resets the user to EMPLOYEE, saves `body` over it, and returns the stored roleId. */
	async function persist(body: Record<string, unknown>): Promise<string | null> {
		await users.save({ id: USER_ID, email: 'ada@example.com', roleId: EMP });
		await users.save({ id: USER_ID, ...body } as any);
		const [row] = await dataSource.query('SELECT "roleId" FROM "role_payload_user" WHERE "id" = ?', [USER_ID]);
		return row.roleId;
	}

	/** The exact pre-fix extraction (updateProfile / UserCreateHandler / assertCanAssignRoles). */
	const preFixCheckedIds = (body: any): string[] => [body.role?.id, body.roleId].filter((id) => !!id);

	describe('CONTROL: pre-fix — what was checked is not what was stored', () => {
		it('a bare-string role is checked as nothing, yet rewrites the stored FK', async () => {
			const body = { role: SA };
			expect(preFixCheckedIds(body)).toEqual([]);
			// TypeORM does not write the string as the id here (MikroORM does, as a reference) — it
			// clears the FK. Either way the stored role changed without any role check running.
			await expect(persist(body)).resolves.not.toBe(EMP);
		});

		it('a role object next to a different roleId stores the relation', async () => {
			const body = { roleId: EMP, role: { id: SA } };
			expect(preFixCheckedIds(body)).toContain(EMP);
			await expect(persist(body)).resolves.toBe(SA);
		});

		it('a null role clears the stored role without any check', async () => {
			const body = { role: null };
			expect(preFixCheckedIds(body)).toEqual([]);
			await expect(persist(body)).resolves.toBeNull();
		});
	});

	describe('fixed — every accepted shape stores exactly the checked id', () => {
		it.each([
			[{ role: SA }],
			[{ role: { id: SA } }],
			[{ role: { id: SA, name: 'SUPER_ADMIN' } }],
			[{ roleId: SA }],
			[{ roleId: SA, role: SA }],
			[{ roleId: SA, role: { id: SA } }]
		])('%p', async (raw) => {
			const body: any = JSON.parse(JSON.stringify(raw));
			normalizeRolePayload(body);
			const checked = extractRoleIds(body);

			expect(checked).toEqual([SA]);
			await expect(persist(body)).resolves.toBe(SA);
		});

		it('a null role / roleId is stripped and the stored role is kept', async () => {
			const body: any = { role: null, roleId: null };
			normalizeRolePayload(body);

			expect(extractRoleIds(body)).toEqual([]);
			await expect(persist(body)).resolves.toBe(EMP);
		});

		it('a pair that disagrees is refused before anything is written', () => {
			expect(() => normalizeRolePayload({ roleId: EMP, role: { id: SA } })).toThrow();
			expect(() => normalizeRolePayload({ roleId: EMP, role: SA })).toThrow();
		});
	});
});
