import '../entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema, In, Repository } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';
import { TenantAwareCrudService } from './tenant-aware-crud.service';
import { assertGraphNotForeign, CASCADE_PROTECTED_USER_FIELDS } from './nested-graph-ownership.helper';
import { TimeLogService } from '../../time-tracking/time-log/time-log.service';
import { TimeSlotService } from '../../time-tracking/time-slot/time-slot.service';

/**
 * GHSA-jh6m-9fxr-rx3c — nested-relation takeover through create({ ...body, id }) / save().
 *
 * `assertNotForeignRow` guards the ROOT id only. TypeORM resolves every nested object by primary key
 * alone, so a payload on the caller's OWN row could overwrite, re-parent or claim another tenant's
 * rows through its relations. Every "refused" case below has a CONTROL arm that runs the very same
 * payload through a plain `repository.save()` — the pre-fix persistence path — against a real
 * better-sqlite3 database and shows the exploit landing. A green run therefore proves the check is
 * what makes the difference, not a fixture that could never be exploited.
 */

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

const tenantColumns = {
	id: { primary: true, type: 'varchar', generated: 'uuid' },
	tenantId: { type: 'varchar', nullable: true }
} as const;

const ParentSchema = new EntitySchema<any>({
	name: 'Parent',
	tableName: 'parent',
	columns: { ...tenantColumns, name: { type: 'varchar', nullable: true } },
	relations: {
		children: { type: 'one-to-many', target: 'Child', inverseSide: 'parent', cascade: true },
		plainChildren: { type: 'one-to-many', target: 'PlainChild', inverseSide: 'parent' },
		tags: { type: 'many-to-many', target: 'Tag', joinTable: { name: 'parent_tag' } },
		user: { type: 'one-to-one', target: 'User', joinColumn: { name: 'userId' }, cascade: true },
		kind: { type: 'many-to-one', target: 'Kind', joinColumn: { name: 'kindId' }, cascade: true }
	}
});

const ChildSchema = new EntitySchema<any>({
	name: 'Child',
	tableName: 'child',
	columns: {
		...tenantColumns,
		price: { type: 'int', default: 0 },
		parentId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		parent: { type: 'many-to-one', target: 'Parent', inverseSide: 'children', joinColumn: { name: 'parentId' } },
		grandChildren: { type: 'one-to-many', target: 'GrandChild', inverseSide: 'child', cascade: true }
	}
});

const GrandChildSchema = new EntitySchema<any>({
	name: 'GrandChild',
	tableName: 'grand_child',
	columns: {
		...tenantColumns,
		note: { type: 'varchar', nullable: true },
		childId: { type: 'varchar', nullable: true }
	},
	relations: {
		child: { type: 'many-to-one', target: 'Child', inverseSide: 'grandChildren', joinColumn: { name: 'childId' } }
	}
});

const PlainChildSchema = new EntitySchema<any>({
	name: 'PlainChild',
	tableName: 'plain_child',
	columns: { ...tenantColumns, parentId: { type: 'varchar', nullable: true } },
	relations: {
		parent: { type: 'many-to-one', target: 'Parent', inverseSide: 'plainChildren', joinColumn: { name: 'parentId' } }
	}
});

const TagSchema = new EntitySchema<any>({
	name: 'Tag',
	tableName: 'tag',
	columns: { ...tenantColumns, name: { type: 'varchar', nullable: true } }
});

const KindSchema = new EntitySchema<any>({
	name: 'Kind',
	tableName: 'kind',
	columns: { ...tenantColumns, name: { type: 'varchar', nullable: true } }
});

const UserSchema = new EntitySchema<any>({
	name: 'User',
	tableName: 'user',
	columns: {
		...tenantColumns,
		firstName: { type: 'varchar', nullable: true },
		email: { type: 'varchar', nullable: true },
		hash: { type: 'varchar', nullable: true }
	}
});

describe('assertGraphNotForeign (GHSA-jh6m-9fxr-rx3c)', () => {
	let dataSource: DataSource;
	let parents: Repository<any>;
	let children: Repository<any>;
	let grandChildren: Repository<any>;
	let plainChildren: Repository<any>;
	let tags: Repository<any>;
	let kinds: Repository<any>;
	let users: Repository<any>;

	/** The check, exactly as TenantAwareCrudService runs it, for tenant A. */
	const check = (payload: any, tenantId: string | null = TENANT_A) =>
		assertGraphNotForeign(dataSource.manager, parents.metadata, [payload], tenantId);

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [ParentSchema, ChildSchema, GrandChildSchema, PlainChildSchema, TagSchema, KindSchema, UserSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		parents = dataSource.getRepository('Parent');
		children = dataSource.getRepository('Child');
		grandChildren = dataSource.getRepository('GrandChild');
		plainChildren = dataSource.getRepository('PlainChild');
		tags = dataSource.getRepository('Tag');
		kinds = dataSource.getRepository('Kind');
		users = dataSource.getRepository('User');
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	const seed = async () => {
		const ownParent = await parents.save({ tenantId: TENANT_A, name: 'own' });
		const foreignParent = await parents.save({ tenantId: TENANT_B, name: 'foreign' });
		const ownChild = await children.save({ tenantId: TENANT_A, price: 10, parentId: ownParent.id });
		const foreignChild = await children.save({ tenantId: TENANT_B, price: 20, parentId: foreignParent.id });
		return { ownParent, foreignParent, ownChild, foreignChild };
	};

	describe('cascaded one-to-many (invoice.invoiceItems)', () => {
		it('CONTROL: a plain save overwrites and re-parents the foreign child', async () => {
			const { ownParent, foreignChild } = await seed();

			await parents.save({ id: ownParent.id, children: [{ id: foreignChild.id, price: 999 }] });

			const after = await children.findOneBy({ id: foreignChild.id });
			expect(after.price).toBe(999);
			expect(after.parentId).toBe(ownParent.id);
		});

		it('refuses the foreign child and leaves it untouched', async () => {
			const { ownParent, foreignParent, foreignChild } = await seed();

			await expect(check({ id: ownParent.id, children: [{ id: foreignChild.id, price: 999 }] })).rejects.toThrow(
				ForbiddenException
			);

			const after = await children.findOneBy({ id: foreignChild.id });
			expect(after).toMatchObject({ price: 20, parentId: foreignParent.id, tenantId: TENANT_B });
		});

		it('refuses a soft-deleted foreign child too (save() reaches those as well)', async () => {
			const { ownParent, foreignChild } = await seed();
			await children.softDelete({ id: foreignChild.id });

			await expect(check({ id: ownParent.id, children: [{ id: foreignChild.id, price: 1 }] })).rejects.toThrow(
				ForbiddenException
			);
		});

		it('refuses a bare foreign id (a primitive is treated as a key)', async () => {
			const { ownParent, foreignChild } = await seed();

			await expect(check({ id: ownParent.id, children: [foreignChild.id] })).rejects.toThrow(ForbiddenException);
		});

		it('allows editing the own children and adding new ones', async () => {
			const { ownParent, ownChild } = await seed();
			const payload = { id: ownParent.id, children: [{ id: ownChild.id, price: 11 }, { price: 12 }] };

			await expect(check(payload)).resolves.toBeUndefined();
			await parents.save(payload);

			const rows = await children.find({ where: { parentId: ownParent.id }, order: { price: 'ASC' } });
			expect(rows.map((row) => [row.price, row.tenantId])).toEqual([
				[11, TENANT_A],
				[12, TENANT_A]
			]);
		});

		it("CONTROL: a plain save inserts a new child into the tenant named in the body", async () => {
			const { ownParent } = await seed();

			await parents.save({ id: ownParent.id, children: [{ price: 5, tenantId: TENANT_B }] });

			expect((await children.findOneBy({ price: 5 })).tenantId).toBe(TENANT_B);
		});

		it("stamps the caller's tenant onto a new nested child, whatever the body says", async () => {
			const { ownParent } = await seed();
			const payload = { id: ownParent.id, children: [{ price: 5, tenantId: TENANT_B }] };

			await check(payload);
			await parents.save(payload);

			expect((await children.findOneBy({ price: 5 })).tenantId).toBe(TENANT_A);
		});

		it('follows cascades below the first level (child.grandChildren)', async () => {
			const { ownParent, ownChild } = await seed();
			const foreignGrandChild = await grandChildren.save({ tenantId: TENANT_B, note: 'theirs' });

			await expect(
				check({
					id: ownParent.id,
					children: [{ id: ownChild.id, grandChildren: [{ id: foreignGrandChild.id, note: 'mine' }] }]
				})
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe('one-to-many WITHOUT cascade', () => {
		it('CONTROL: a plain save still re-parents the foreign row', async () => {
			const { ownParent } = await seed();
			const foreignPlain = await plainChildren.save({ tenantId: TENANT_B });

			await parents.save({ id: ownParent.id, plainChildren: [{ id: foreignPlain.id }] });

			expect((await plainChildren.findOneBy({ id: foreignPlain.id })).parentId).toBe(ownParent.id);
		});

		it('refuses the foreign row', async () => {
			const { ownParent } = await seed();
			const foreignPlain = await plainChildren.save({ tenantId: TENANT_B });

			await expect(check({ id: ownParent.id, plainChildren: [{ id: foreignPlain.id }] })).rejects.toThrow(
				ForbiddenException
			);
		});

		it('allows a NULL-tenant row only when it already belongs to this parent', async () => {
			const { ownParent } = await seed();
			const linkedLegacy = await plainChildren.save({ tenantId: null, parentId: ownParent.id });
			const unlinkedLegacy = await plainChildren.save({ tenantId: null, parentId: null });

			await expect(check({ id: ownParent.id, plainChildren: [{ id: linkedLegacy.id }] })).resolves.toBeUndefined();
			await expect(check({ id: ownParent.id, plainChildren: [{ id: unlinkedLegacy.id }] })).rejects.toThrow(
				ForbiddenException
			);
		});
	});

	describe('many-to-many links (tags)', () => {
		it('keeps global (NULL-tenant) and own tags linkable', async () => {
			const { ownParent } = await seed();
			const globalTag = await tags.save({ tenantId: null, name: 'global' });
			const ownTag = await tags.save({ tenantId: TENANT_A, name: 'own' });

			await expect(
				check({ id: ownParent.id, tags: [{ id: globalTag.id, name: 'global' }, { id: ownTag.id }] })
			).resolves.toBeUndefined();
		});

		it("refuses another tenant's tag", async () => {
			const { ownParent } = await seed();
			const foreignTag = await tags.save({ tenantId: TENANT_B, name: 'foreign' });

			await expect(check({ id: ownParent.id, tags: [{ id: foreignTag.id }] })).rejects.toThrow(ForbiddenException);
		});
	});

	describe('cascaded owner relation to a global row (parent.kind)', () => {
		it('CONTROL: a plain save writes into the global row', async () => {
			const { ownParent } = await seed();
			const globalKind = await kinds.save({ tenantId: null, name: 'system' });

			await parents.save({ id: ownParent.id, kind: { id: globalKind.id, name: 'hijacked' } });

			expect((await kinds.findOneBy({ id: globalKind.id })).name).toBe('hijacked');
		});

		it('keeps the link but never writes the global row', async () => {
			const { ownParent } = await seed();
			const globalKind = await kinds.save({ tenantId: null, name: 'system' });
			const payload: any = { id: ownParent.id, kind: { id: globalKind.id, name: 'hijacked' } };

			await check(payload);
			expect(payload.kind).toEqual({ id: globalKind.id });
			await parents.save(payload);

			expect(await kinds.findOneBy({ id: globalKind.id })).toMatchObject({ name: 'system', tenantId: null });
			expect(await parents.findOne({ where: { id: ownParent.id }, relations: { kind: true } })).toMatchObject({
				kind: { id: globalKind.id }
			});
		});
	});

	describe('cascaded user (candidate.user)', () => {
		it('CONTROL: a plain save rewrites the password hash of another user of the same tenant', async () => {
			const { ownParent } = await seed();
			const admin = await users.save({ tenantId: TENANT_A, email: 'admin@a', hash: 'admin-hash' });

			await parents.save({ id: ownParent.id, user: { id: admin.id, hash: 'attacker-hash', email: 'x@evil' } });

			expect(await users.findOneBy({ id: admin.id })).toMatchObject({ hash: 'attacker-hash', email: 'x@evil' });
		});

		it("never writes an existing user's credentials, even inside the tenant", async () => {
			const { ownParent } = await seed();
			const admin = await users.save({ tenantId: TENANT_A, email: 'admin@a', hash: 'admin-hash' });
			const original = { id: admin.id, hash: 'attacker-hash', email: 'x@evil', firstName: 'Renamed' };
			const payload: any = { id: ownParent.id, user: original };

			await check(payload);
			await parents.save(payload);

			expect(await users.findOneBy({ id: admin.id })).toMatchObject({
				hash: 'admin-hash',
				email: 'admin@a',
				firstName: 'Renamed'
			});
			// The caller's object is not mutated; the payload got a copy.
			expect(original.hash).toBe('attacker-hash');
			expect(CASCADE_PROTECTED_USER_FIELDS).toEqual(expect.arrayContaining(['hash', 'email', 'role', 'roleId']));
		});

		it("refuses another tenant's user", async () => {
			const { ownParent } = await seed();
			const foreignUser = await users.save({ tenantId: TENANT_B, email: 'b@b', hash: 'b' });

			await expect(check({ id: ownParent.id, user: { id: foreignUser.id, hash: 'x' } })).rejects.toThrow(
				ForbiddenException
			);
		});

		it('lets a NEW user keep its credentials (candidate sign-up)', async () => {
			const payload: any = { tenantId: TENANT_A, user: { email: 'new@a', hash: 'new-hash' } };

			await check(payload);
			const saved = await parents.save(payload);

			expect(await users.findOneBy({ id: saved.user.id })).toMatchObject({
				hash: 'new-hash',
				email: 'new@a',
				tenantId: TENANT_A
			});
		});
	});

	describe('cost and scope', () => {
		it('runs one lookup per relation, not one per nested object', async () => {
			const { ownParent } = await seed();
			const own = await children.save([
				{ tenantId: TENANT_A, parentId: ownParent.id },
				{ tenantId: TENANT_A, parentId: ownParent.id },
				{ tenantId: TENANT_A, parentId: ownParent.id }
			]);
			const tag = await tags.save({ tenantId: TENANT_A });
			const spy = jest.spyOn(dataSource.manager, 'getRepository');

			await check({ id: ownParent.id, children: own.map(({ id }) => ({ id })), tags: [{ id: tag.id }] });

			expect(spy.mock.calls.map(([target]) => (target as any).options?.name ?? target)).toEqual(['Child', 'Tag']);
		});

		it('checks nothing without a tenant (seeds, background jobs)', async () => {
			const { ownParent, foreignChild } = await seed();

			await expect(
				check({ id: ownParent.id, children: [{ id: foreignChild.id }] }, null)
			).resolves.toBeUndefined();
		});

		it('turns an unreadable id into a 400 rather than letting it through', async () => {
			const { ownParent } = await seed();
			jest.spyOn(dataSource.manager, 'getRepository').mockImplementation(() => {
				throw new Error('invalid input syntax for type uuid');
			});

			await expect(check({ id: ownParent.id, children: [{ id: 'not-a-uuid' }] })).rejects.toThrow(
				BadRequestException
			);
		});
	});

	describe('through TenantAwareCrudService', () => {
		class ParentService extends TenantAwareCrudService<any> {
			constructor(repository: Repository<any>) {
				super(repository, {} as any);
			}
		}

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
			jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
				(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);
			jest.spyOn(console, 'error').mockImplementation(() => undefined);
		});

		afterEach(() => jest.restoreAllMocks());

		it('create({ ...body, id }) refuses a foreign nested child on the caller’s own row', async () => {
			const { ownParent, foreignChild } = await seed();
			const service = new ParentService(parents);

			await expect(
				service.create({ id: ownParent.id, children: [{ id: foreignChild.id, price: 999 }] })
			).rejects.toThrow(ForbiddenException);
			expect((await children.findOneBy({ id: foreignChild.id })).price).toBe(20);
		});

		it('saveMany() refuses it too, and still saves legitimate graphs', async () => {
			const { ownParent, ownChild, foreignChild } = await seed();
			const service = new ParentService(parents);

			await expect(
				service.saveMany([{ id: ownParent.id, children: [{ id: foreignChild.id }] }])
			).rejects.toThrow(ForbiddenException);

			await service.saveMany([{ id: ownParent.id, children: [{ id: ownChild.id, price: 42 }] }]);
			expect((await children.findOneBy({ id: ownChild.id })).price).toBe(42);
		});
	});

	describe('ids that resolve case-insensitively (Postgres uuid / MySQL collation)', () => {
		/**
		 * Postgres stores and renders `uuid` lower case, and MySQL's default collation ignores case, so
		 * `AAAA-…` in the payload addresses the row stored as `aaaa-…` — both here and later, inside
		 * `save()`. `COLLATE NOCASE` reproduces that on sqlite.
		 */
		const caseColumns = {
			id: { primary: true, type: 'varchar', collation: 'NOCASE' },
			tenantId: { type: 'varchar', nullable: true }
		} as const;

		const CaseParentSchema = new EntitySchema<any>({
			name: 'CaseParent',
			tableName: 'case_parent',
			columns: { ...caseColumns },
			relations: {
				// No cascade: TypeORM re-parents the child by id alone, which is the write this addresses.
				children: { type: 'one-to-many', target: 'CaseChild', inverseSide: 'parent' }
			}
		});

		const CaseChildSchema = new EntitySchema<any>({
			name: 'CaseChild',
			tableName: 'case_child',
			columns: {
				...caseColumns,
				price: { type: 'int', nullable: true },
				parentId: { type: 'varchar', nullable: true }
			},
			relations: {
				parent: {
					type: 'many-to-one',
					target: 'CaseParent',
					inverseSide: 'children',
					joinColumn: { name: 'parentId' }
				}
			}
		});

		const OWN_PARENT = 'cccccccc-1111-4111-8111-111111111111';
		const FOREIGN_CHILD = 'dddddddd-2222-4222-8222-222222222222';

		let caseSource: DataSource;

		beforeEach(async () => {
			caseSource = new DataSource({
				type: 'better-sqlite3',
				database: ':memory:',
				entities: [CaseParentSchema, CaseChildSchema],
				synchronize: true,
				logging: false
			});
			await caseSource.initialize();
			await caseSource.getRepository('CaseParent').save({ id: OWN_PARENT, tenantId: TENANT_A });
			await caseSource.getRepository('CaseChild').save({ id: FOREIGN_CHILD, tenantId: TENANT_B, price: 20 });
		});

		afterEach(async () => {
			await caseSource.destroy();
		});

		const payload = () => ({
			id: OWN_PARENT,
			children: [{ id: FOREIGN_CHILD.toUpperCase() }]
		});

		it('CONTROL: a plain save claims the foreign row through the upper-cased id', async () => {
			await caseSource.getRepository('CaseParent').save(payload());

			const stored = await caseSource.getRepository('CaseChild').findOneBy({ id: FOREIGN_CHILD });
			expect(stored.parentId).toBe(OWN_PARENT);
			expect(stored.tenantId).toBe(TENANT_B);
		});

		it('refuses it, instead of missing the row and waving the payload through', async () => {
			await expect(
				assertGraphNotForeign(
					caseSource.manager,
					caseSource.getMetadata('CaseParent'),
					[payload()],
					TENANT_A
				)
			).rejects.toThrow(ForbiddenException);

			const stored = await caseSource.getRepository('CaseChild').findOneBy({ id: FOREIGN_CHILD });
			expect(stored.parentId).toBeNull();
		});
	});

	describe('never-matching employee condition (GHSA-6qvm-3wg4-26w4, time logs / slots)', () => {
		const RowSchema = new EntitySchema<any>({
			name: 'Row',
			tableName: 'row',
			columns: { id: { primary: true, type: 'varchar', generated: 'uuid' }, employeeId: { type: 'varchar' } }
		});

		it('`employeeId IN ()` matches nothing, where the old empty condition matched every row', async () => {
			const rowsSource = new DataSource({
				type: 'better-sqlite3',
				database: ':memory:',
				entities: [RowSchema],
				synchronize: true
			});
			await rowsSource.initialize();
			try {
				const rows = rowsSource.getRepository('Row');
				await rows.save([{ employeeId: 'e1' }, { employeeId: 'e2' }]);

				// CONTROL: the historical fallback for a caller with no employee record.
				expect(await rows.count({ where: {} })).toBe(2);
				expect(await rows.count({ where: { employeeId: In([]) } })).toBe(0);
			} finally {
				await rowsSource.destroy();
			}
		});

		it('the time log and time slot services replace the tenant-wide fallback', () => {
			const base = (TenantAwareCrudService.prototype as any).findConditionsWithoutOwnEmployee;

			// CONTROL: everywhere else the fallback stays what it always was — tenant-wide.
			expect(base.call({})).toEqual({});

			for (const service of [TimeLogService, TimeSlotService]) {
				const hook = (service.prototype as any).findConditionsWithoutOwnEmployee;
				expect(hook).not.toBe(base);
				expect(hook.call(service.prototype)).toEqual({ employeeId: In([]) });
			}
		});

		it('a caller with neither CHANGE_SELECTED_EMPLOYEE nor an employee record reaches the fallback', async () => {
			const rowsSource = new DataSource({
				type: 'better-sqlite3',
				database: ':memory:',
				entities: [RowSchema],
				synchronize: true
			});
			await rowsSource.initialize();
			try {
				const rows = rowsSource.getRepository('Row');
				// No tenant column on this fixture: the case is about the EMPLOYEE half of the condition.
				await rows.save([{ employeeId: 'e1' }, { employeeId: 'e2' }]);

				class RowService extends TenantAwareCrudService<any> {
					constructor() {
						super(rows as any, {} as any);
					}
				}
				const service = new RowService();

				jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
				jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'u1', tenantId: TENANT_A } as any);
				jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
				jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);

				// CONTROL: the inherited fallback leaves the read tenant-wide.
				expect(await service.find()).toHaveLength(2);

				jest.spyOn(RowService.prototype as any, 'findConditionsWithoutOwnEmployee').mockReturnValue({
					employeeId: In([])
				});
				expect(await service.find()).toHaveLength(0);
			} finally {
				jest.restoreAllMocks();
				await rowsSource.destroy();
			}
		});
	});
});
