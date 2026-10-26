import { Column, DataSource, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryColumn, RelationId } from 'typeorm';
import { RelationIdLoader } from 'typeorm/query-builder/relation-id/RelationIdLoader';
import { applyTypeOrmReadPathPatches, isColumnBackedRelationId } from './typeorm-read-path.patches';

@Entity('rp_tenant')
class RpTenant {
	@PrimaryColumn('varchar') id: string;
	@Column('varchar') name: string;
}

@Entity('rp_tag')
class RpTag {
	@PrimaryColumn('varchar') id: string;
}

@Entity('rp_owner')
class RpOwner {
	@PrimaryColumn('varchar') id: string;

	@ManyToOne(() => RpTenant, { nullable: true })
	tenant?: RpTenant;

	// The Gauzy shape: a relation id that is ALSO the foreign-key column.
	@RelationId((it: RpOwner) => it.tenant)
	@Column({ type: 'varchar', nullable: true })
	tenantId?: string;
}

@Entity('rp_row')
class RpRow {
	@PrimaryColumn('varchar') id: string;

	@ManyToOne(() => RpTenant, { nullable: true })
	tenant?: RpTenant;

	@RelationId((it: RpRow) => it.tenant)
	@Column({ type: 'varchar', nullable: true })
	tenantId?: string;

	@ManyToOne(() => RpOwner, { nullable: true })
	owner?: RpOwner;

	@RelationId((it: RpRow) => it.owner)
	@Column({ type: 'varchar', nullable: true })
	ownerId?: string;

	// A relation id with no column behind it: must still be loaded.
	@ManyToMany(() => RpTag)
	@JoinTable({ name: 'rp_row_tags' })
	tags?: RpTag[];

	@RelationId((it: RpRow) => it.tags)
	tagIds?: string[];
}

describe('typeorm read-path patches', () => {
	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [RpTenant, RpTag, RpOwner, RpRow],
			synchronize: true
		});
		await dataSource.initialize();
		await dataSource.query(`INSERT INTO rp_tenant (id, name) VALUES ('t1', 'one'), ('t2', 'two')`);
		await dataSource.query(`INSERT INTO rp_tag (id) VALUES ('g1'), ('g2')`);
		await dataSource.query(`INSERT INTO rp_owner (id, tenantId) VALUES ('o1', 't1'), ('o2', NULL)`);
		await dataSource.query(
			`INSERT INTO rp_row (id, tenantId, ownerId) VALUES ('r1', 't1', 'o1'), ('r2', 't2', NULL), ('r3', NULL, 'o2')`
		);
		await dataSource.query(
			`INSERT INTO rp_row_tags (rpRowId, rpTagId) VALUES ('r1', 'g1'), ('r1', 'g2'), ('r3', 'g2')`
		);
	});

	afterAll(() => dataSource?.destroy());

	const reads = () => {
		const repo = dataSource.getRepository(RpRow);
		return Promise.all([
			repo.find({ order: { id: 'ASC' } }),
			repo.find({ relations: { tenant: true, owner: { tenant: true } }, order: { id: 'ASC' } }),
			repo.find({ where: { tenantId: 't1' }, take: 1, relations: { owner: true } }),
			repo.find({ select: { id: true }, order: { id: 'ASC' } }),
			repo.findOne({ where: { id: 'r3' }, relations: { owner: true } })
		]);
	};

	it('classifies only to-one relation ids that are their own foreign-key column', () => {
		const ids = dataSource.getMetadata(RpRow).relationIds;
		const byName = Object.fromEntries(ids.map((r) => [r.propertyName, isColumnBackedRelationId(r)]));
		expect(byName).toEqual({ tenantId: true, ownerId: true, tagIds: false });
	});

	it('returns exactly the same entities, while skipping the column-backed relation ids', async () => {
		const before = JSON.parse(JSON.stringify(await reads()));
		const load = jest.spyOn(RelationIdLoader.prototype, 'load');
		await reads();
		const attributesBefore = load.mock.instances.map((i: any) => i.relationIdAttributes.length);
		load.mockClear();

		expect(applyTypeOrmReadPathPatches({})).toBe(true);

		const after = JSON.parse(JSON.stringify(await reads()));
		const attributesAfter = load.mock.instances.map((i: any) => i.relationIdAttributes.length);
		load.mockRestore();

		expect(after).toEqual(before);
		// The many-to-many tagIds are still loaded (and present); the column-backed ids are not re-derived.
		expect(after[0].find((r: any) => r.id === 'r1').tagIds.sort()).toEqual(['g1', 'g2']);
		expect(after[0].find((r: any) => r.id === 'r2')).toMatchObject({ tenantId: 't2', ownerId: null });
		expect(after[1].find((r: any) => r.id === 'r1').owner).toMatchObject({ id: 'o1', tenantId: 't1' });
		expect(after[3][0]).toEqual({ id: 'r1', tagIds: ['g1', 'g2'] });
		expect(attributesAfter.reduce((a, b) => a + b, 0)).toBeLessThan(attributesBefore.reduce((a, b) => a + b, 0));
	});

	it('still fills a relation id after a save, which reads the metadata the patch leaves alone', async () => {
		applyTypeOrmReadPathPatches({});
		const saved = await dataSource.getRepository(RpRow).save({ id: 'r9', tenant: { id: 't2' } as RpTenant });
		expect(saved.tenantId).toBe('t2');
	});

	it('does nothing when switched off', () => {
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const fresh = require('./typeorm-read-path.patches');
			expect(fresh.applyTypeOrmReadPathPatches({ TYPEORM_SKIP_REDUNDANT_RELATION_IDS: 'false' })).toBe(false);
		});
	});
});
