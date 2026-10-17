// The dialect helpers read DB_TYPE once, when @gauzy/config loads; the real entity graph below is built on
// better-sqlite3, as the demo runs it. `getConfig` is a mock so a case can declare a Tag custom field.
jest.mock('@gauzy/config', () => {
	process.env.DB_TYPE = 'better-sqlite3';
	const actual = jest.requireActual('@gauzy/config');
	return { ...actual, getConfig: jest.fn(actual.getConfig) };
});

import '../core/entities/internal';

import {
	Column,
	DataSource,
	DeleteDateColumn,
	Entity,
	EntityMetadata,
	JoinTable,
	ManyToMany,
	PrimaryColumn,
	Repository,
	SelectQueryBuilder
} from 'typeorm';
import * as config from '@gauzy/config';
import { FileStorageProviderEnum, ITagFindInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum, parseFindOptionsRelations } from '../core/utils';
import { FileStorage } from '../core/file-storage';
import { prepareSQLQuery as p } from '../database/database.helper';
import { manyToManyCountSubquery } from './relation-count-subquery';
import { Tag } from './tag.entity';
import { TAG_USAGE_COUNTERS, TagService } from './tag.service';

/**
 * The tags list (`GET /api/tags`, `TagService.findTags`) used to LEFT JOIN every relation a tag can be attached to
 * (25 of them, plus the many-to-many custom fields) and count each with `COUNT(DISTINCT alias.id) ... GROUP BY
 * tag.id`: the database built the cross product of every relation row of a tag before grouping, a second per
 * request on a demo tenant. Each counter is now a correlated scalar subquery (`manyToManyCountSubquery`).
 *
 * The cases below run both queries on a real database — the query `findTags` builds now, and a copy of the query it
 * built before (`legacyFindTags`, kept here as the control) — and require identical rows: same columns, same
 * counters, same tags. In particular the old LEFT JOIN of a soft-deletable target carried TypeORM's
 * `deletedAt IS NULL` in its ON clause, so a soft-deleted target was never counted; the subquery must not count it
 * either.
 */

const ENTITY_GRAPH_TIMEOUT = 180_000;
const actualGetConfig = jest.requireActual<typeof config>('@gauzy/config').getConfig;

/** The old `findTags` TypeORM query, verbatim but for the repository and service it runs on. */
async function legacyFindTags(
	repository: Repository<Tag>,
	service: TagService,
	input: ITagFindInput,
	relations: string[] = []
): Promise<{ items: any[]; total: number }> {
	const customFields = config.getConfig().customFields?.['Tag'] ?? [];

	const query = repository.createQueryBuilder(repository.metadata.tableName);
	query.setFindOptions({
		...(relations ? { relations: parseFindOptionsRelations(relations) } : {})
	});
	query.leftJoin(`${query.alias}.tagType`, 'tagType');
	for (const [relation, alias] of TAG_USAGE_COUNTERS) {
		query.leftJoin(`${query.alias}.${relation}`, alias);
	}
	customFields.forEach((field) => {
		if (field.relationType === 'many-to-many') {
			query.leftJoin(`${query.alias}.customFields.${field.name}`, field.name);
		}
	});
	query.select(`${query.alias}.*`);
	query.addSelect(p(`"tagType"."type"`), `tagTypeName`);
	for (const [, alias, counter] of TAG_USAGE_COUNTERS) {
		query.addSelect(p(`CAST(COUNT(DISTINCT "${alias}"."id") AS INTEGER)`), counter);
	}
	customFields.forEach((field) => {
		if (field.relationType === 'many-to-many') {
			query.addSelect(`CAST(COUNT(DISTINCT ${field.name}.id) AS INTEGER)`, `${field.name}_counter`);
		}
	});
	query.addGroupBy(`${query.alias}.id`);
	query.addGroupBy(`tagType.type`);
	query.where((qb: SelectQueryBuilder<Tag>) => {
		service.getFilterTagQuery(qb, input);
	});
	let items = await query.getRawMany();

	const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
	items = await Promise.all(
		items.map(async (item) => {
			if (item.icon) item.fullIconUrl = await store.getProviderInstance().url(item.icon);
			return item;
		})
	);
	return { items, total: items.length };
}

const byId = (rows: any[]) => [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));

/* -------------------------------------------------------------------------------------------------------------- */
/* 1. The subquery builder on a minimal entity graph                                                              */
/* -------------------------------------------------------------------------------------------------------------- */

@Entity('counter_note')
class CounterNote {
	@PrimaryColumn({ type: 'varchar' })
	id: string;

	@DeleteDateColumn({ type: 'datetime', nullable: true })
	deletedAt?: Date;
}

@Entity('counter_label')
class CounterLabel {
	@PrimaryColumn({ type: 'varchar' })
	id: string;

	@DeleteDateColumn({ type: 'datetime', nullable: true })
	deletedAt?: Date;
}

/** A relation inside an embedded, the way custom fields declare theirs (`tag.customFields.<name>`). */
class CounterTagCustomFields {
	@ManyToMany(() => CounterLabel)
	@JoinTable({ name: 'counter_tag_label' })
	labels?: CounterLabel[];

	@Column({ type: 'boolean', nullable: true, select: false })
	fix?: boolean;
}

@Entity('counter_tag')
class CounterTag {
	@PrimaryColumn({ type: 'varchar' })
	id: string;

	@DeleteDateColumn({ type: 'datetime', nullable: true })
	deletedAt?: Date;

	/** Owning side, soft-deletable target. */
	@ManyToMany(() => CounterNote)
	@JoinTable({ name: 'counter_tag_note' })
	notes?: CounterNote[];

	/** Inverse side, target without a delete-date column. */
	@ManyToMany(() => CounterBoard, (board) => board.tags)
	boards?: CounterBoard[];

	/** Inverse side, soft-deletable target, junction columns with their own names. */
	@ManyToMany(() => CounterPerson, (person) => person.tags)
	people?: CounterPerson[];

	@Column(() => CounterTagCustomFields, { prefix: false })
	customFields?: CounterTagCustomFields;
}

@Entity('counter_board')
class CounterBoard {
	@PrimaryColumn({ type: 'varchar' })
	id: string;

	@ManyToMany(() => CounterTag, (tag) => tag.boards)
	@JoinTable({ name: 'counter_board_tag' })
	tags?: CounterTag[];
}

@Entity('counter_person')
class CounterPerson {
	@PrimaryColumn({ type: 'varchar' })
	id: string;

	@DeleteDateColumn({ type: 'datetime', nullable: true })
	deletedAt?: Date;

	@ManyToMany(() => CounterTag, (tag) => tag.people)
	@JoinTable({
		name: 'counter_person_tag',
		joinColumn: { name: 'personRef', referencedColumnName: 'id' },
		inverseJoinColumn: { name: 'tagRef', referencedColumnName: 'id' }
	})
	tags?: CounterTag[];
}

describe('manyToManyCountSubquery (minimal entities on SQLite)', () => {
	const RELATIONS = ['notes', 'boards', 'people', 'customFields.labels'];
	let dataSource: DataSource;
	let metadata: EntityMetadata;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [CounterTag, CounterNote, CounterBoard, CounterPerson, CounterLabel],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		metadata = dataSource.getMetadata(CounterTag);

		const retired = new Date('2026-01-01T00:00:00.000Z');
		await dataSource
			.getRepository(CounterTag)
			.save(['busy', 'quiet', 'retired-only', 'gone'].map((id) => ({ id })));
		await dataSource.getRepository(CounterTag).softDelete('gone');
		await dataSource
			.getRepository(CounterNote)
			.save([{ id: 'n1' }, { id: 'n2' }, { id: 'n3', deletedAt: retired }]);
		await dataSource.getRepository(CounterBoard).save([{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }]);
		await dataSource.getRepository(CounterPerson).save([{ id: 'p1' }, { id: 'p2', deletedAt: retired }]);
		await dataSource.getRepository(CounterLabel).save([{ id: 'l1' }, { id: 'l2', deletedAt: retired }]);

		const link = (relation: string, tag: string, targets: string[]) =>
			dataSource.createQueryBuilder().relation(CounterTag, relation).of(tag).add(targets);
		await link('notes', 'busy', ['n1', 'n2', 'n3']);
		await link('boards', 'busy', ['b1', 'b2', 'b3']);
		await link('people', 'busy', ['p1', 'p2']);
		await link('customFields.labels', 'busy', ['l1', 'l2']);
		await link('boards', 'quiet', ['b1']);
		await link('notes', 'retired-only', ['n3']);
		await link('people', 'retired-only', ['p2']);
		await link('customFields.labels', 'retired-only', ['l2']);
		await link('notes', 'gone', ['n1']);
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	/** The counters, as `findTags` used to compute them: every relation LEFT JOINed, grouped by tag. */
	const joined = () => {
		const query = dataSource.getRepository(CounterTag).createQueryBuilder('tag').select('tag.id', 'id');
		RELATIONS.forEach((relation, index) => {
			query.leftJoin(`tag.${relation}`, `r${index}`);
			query.addSelect(`CAST(COUNT(DISTINCT "r${index}"."id") AS INTEGER)`, `c${index}`);
		});
		return query.groupBy('tag.id').getRawMany();
	};

	/** The same counters as correlated subqueries. */
	const subqueries = () => {
		const query = dataSource.getRepository(CounterTag).createQueryBuilder('tag').select('tag.id', 'id');
		RELATIONS.forEach((relation, index) => {
			query.addSelect(
				`CAST(${manyToManyCountSubquery(metadata, relation, 'tag', dataSource.driver)} AS INTEGER)`,
				`c${index}`
			);
		});
		return query.getRawMany();
	};

	it('counts what the LEFT JOIN + GROUP BY query counted, for owning, inverse and embedded relations', async () => {
		const expected = byId(await joined());

		expect(byId(await subqueries())).toStrictEqual(expected);
		// Live targets only: n3, p2 and l2 are soft-deleted; boards have no delete-date column
		expect(expected).toStrictEqual([
			{ id: 'busy', c0: 2, c1: 3, c2: 1, c3: 1 },
			{ id: 'quiet', c0: 0, c1: 1, c2: 0, c3: 0 },
			{ id: 'retired-only', c0: 0, c1: 0, c2: 0, c3: 0 }
		]);
	});

	it('reads the junction table and column names from the relation metadata', () => {
		const sql = manyToManyCountSubquery(metadata, 'people', 'tag', dataSource.driver);

		expect(sql).toBe(
			'(SELECT COUNT(DISTINCT "tag_target"."id") FROM "counter_person_tag" "tag_junction"' +
				' INNER JOIN "counter_person" "tag_target" ON "tag_target"."id" = "tag_junction"."personRef"' +
				' AND "tag_target"."deletedAt" IS NULL' +
				' WHERE "tag_junction"."tagRef" = "tag"."id")'
		);
		// No delete-date column on the target: no soft-delete predicate
		expect(manyToManyCountSubquery(metadata, 'boards', 'tag', dataSource.driver)).not.toMatch(/IS NULL/);
	});

	it("quotes with the database's own escaping (MySQL backticks)", () => {
		const mysql = { escape: (name: string) => `\`${name}\`` };

		expect(manyToManyCountSubquery(metadata, 'customFields.labels', 'tag', mysql)).toBe(
			'(SELECT COUNT(DISTINCT `tag_target`.`id`) FROM `counter_tag_label` `tag_junction`' +
				' INNER JOIN `counter_label` `tag_target` ON `tag_target`.`id` = `tag_junction`.`counterLabelId`' +
				' AND `tag_target`.`deletedAt` IS NULL' +
				' WHERE `tag_junction`.`counterTagId` = `tag`.`id`)'
		);
	});

	it('refuses a path that is not a many-to-many relation', () => {
		expect(() => manyToManyCountSubquery(metadata, 'deletedAt', 'tag', dataSource.driver)).toThrow(
			/not a many-to-many relation/
		);
	});
});

/* -------------------------------------------------------------------------------------------------------------- */
/* 2. TagService.findTags on the real Tag entity graph                                                            */
/* -------------------------------------------------------------------------------------------------------------- */

const TENANT = 'c7000000-0000-4000-8000-000000000001';
const OTHER_TENANT = 'c7000000-0000-4000-8000-000000000002';
const ORGANIZATION = 'c7000000-0000-4000-8000-0000000000a1';
const OTHER_ORGANIZATION = 'c7000000-0000-4000-8000-0000000000a2';
const TAG_TYPE = 'c7000000-0000-4000-8000-0000000000f1';
const RETIRED_AT = '2026-01-01 00:00:00';

/** A many-to-many custom field on Tag, registered on the entity before the graph is built. */
const LABELS_FIELD = {
	name: 'labels',
	type: 'relation',
	relationType: 'many-to-many',
	pivotTable: 'tag_custom_labels',
	entity: undefined as unknown // set to Employee in beforeAll (after the entity graph is loaded)
};

/** The tags seeded, by role. Only the first four are the caller's: the others are filtered out. */
const TAGS = {
	busy: {
		id: 'c7000000-0000-4000-8000-000000000101',
		organizationId: ORGANIZATION,
		tagTypeId: TAG_TYPE,
		icon: 'tags/busy.svg'
	},
	tenantWide: { id: 'c7000000-0000-4000-8000-000000000102', organizationId: null },
	retiredTargetsOnly: { id: 'c7000000-0000-4000-8000-000000000103', organizationId: ORGANIZATION },
	unused: { id: 'c7000000-0000-4000-8000-000000000104', organizationId: ORGANIZATION },
	retiredTag: { id: 'c7000000-0000-4000-8000-000000000105', organizationId: ORGANIZATION, deletedAt: RETIRED_AT },
	systemTag: { id: 'c7000000-0000-4000-8000-000000000106', organizationId: ORGANIZATION, isSystem: 1 },
	otherTenant: {
		id: 'c7000000-0000-4000-8000-000000000107',
		organizationId: OTHER_ORGANIZATION,
		tenantId: OTHER_TENANT
	},
	otherOrganization: { id: 'c7000000-0000-4000-8000-000000000108', organizationId: OTHER_ORGANIZATION }
};

/** A value for a NOT NULL column without a default, so a target row can be inserted with only its id. */
function placeholder(metadata: EntityMetadata, databaseName: string, id: string): unknown {
	const column = metadata.findColumnWithDatabaseName(databaseName);
	if (column.enum?.length) return column.enum[0];
	const type = (typeof column.type === 'function' ? column.type.name : String(column.type)).toLowerCase();
	if (/int|float|double|decimal|numeric|real|number|bool/.test(type)) return 0;
	if (/date|time/.test(type)) return RETIRED_AT;
	if (/json/.test(type)) return '{}';
	return `${databaseName}:${id}`;
}

/** Inserts one row, filling every other required column with a placeholder (foreign keys are off). */
async function insertRow(dataSource: DataSource, metadata: EntityMetadata, values: Record<string, unknown>) {
	const row: Record<string, unknown> = {};
	for (const column of metadata.columns) {
		if (column.isVirtualProperty || column.databaseName in values) continue;
		if (column.isNullable || column.default !== undefined || column.isCreateDate || column.isUpdateDate) continue;
		if (column.isVersion || (column.isGenerated && column.generationStrategy === 'increment')) continue;
		row[column.databaseName] = placeholder(metadata, column.databaseName, String(values['id']));
	}
	Object.assign(row, values);
	const names = Object.keys(row);
	await dataSource.query(
		`INSERT INTO "${metadata.tablePath}" (${names.map((name) => `"${name}"`).join(', ')}) VALUES (${names
			.map(() => '?')
			.join(', ')})`,
		names.map((name) => row[name])
	);
}

/** Relations the busy tag is linked to several live targets of. */
const SEVERAL_TARGETS = ['employees', 'tasks', 'incomes', 'customFields.labels'];
/** Further relations given a soft-deleted target (when theirs is soft-deletable). */
const RETIRED_TARGET = ['candidates', 'organizationProjects'];

describe('TagService.findTags usage counters on the real Tag entity (SQLite)', () => {
	let dataSource: DataSource;
	let repository: Repository<Tag>;
	let service: TagService;
	/** counter name -> [busy, tenantWide, retiredTargetsOnly] expected counts */
	const expected = new Map<string, [number, number, number]>();
	/** Every query builder `findTags` created in a case, to look at the SQL it ran. */
	let built: SelectQueryBuilder<Tag>[];

	const counters = [
		...TAG_USAGE_COUNTERS.map(([relation, , counter]) => [relation, counter] as const),
		['customFields.labels', 'labels_counter'] as const
	];
	const input: ITagFindInput = { tenantId: TENANT, organizationId: ORGANIZATION };

	beforeAll(async () => {
		const { Employee } = require('../core/entities/internal');
		const { coreEntities: entities } = require('../core/entities');
		const {
			registerTypeOrmCustomFields
		} = require('../core/entities/custom-entity-fields/register-custom-entity-fields');

		// What the bootstrap does with the configured custom fields, before the DataSource reads the entities
		LABELS_FIELD.entity = Employee;
		await registerTypeOrmCustomFields({ customFields: { Tag: [LABELS_FIELD] } });

		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			synchronize: true,
			entities,
			logging: false
		});
		await dataSource.initialize();
		await dataSource.query('PRAGMA foreign_keys = OFF');
		repository = dataSource.getRepository(Tag);
		const tagMetadata = repository.metadata;

		await insertRow(dataSource, dataSource.getMetadata('TagType'), {
			id: TAG_TYPE,
			type: 'Priority',
			tenantId: TENANT,
			organizationId: ORGANIZATION
		});
		for (const [name, tag] of Object.entries(TAGS)) {
			await insertRow(dataSource, tagMetadata, {
				name,
				color: '#000000',
				tenantId: TENANT,
				isSystem: 0,
				...tag
			});
		}

		const link = (relation: string, tagId: string, targetIds: string[]) =>
			targetIds.length
				? dataSource.createQueryBuilder().relation(Tag, relation).of(tagId).add(targetIds)
				: Promise.resolve();

		for (const [index, [relation, counter]] of counters.entries()) {
			const target = tagMetadata.findRelationWithPropertyPath(relation).inverseEntityMetadata;
			const targetId = (role: string) =>
				`c7${String(index).padStart(6, '0')}-0000-4000-8000-${role.padStart(12, '0')}`;

			// Several live targets on a few relations, one on the others, and a soft-deleted one on a few
			// soft-deletable targets. Kept small on purpose: the control query joins all of them at once, so the
			// busy tag alone yields the product of its link counts over every relation as rows (the very cost
			// the subqueries remove; a few links on every relation exhausts SQLite's temporary storage).
			const several = SEVERAL_TARGETS.includes(relation);
			const live = Array.from({ length: several ? (index % 2) + 2 : 1 }, (_, n) => targetId(`1${n}`));
			const retired =
				target.deleteDateColumn && (several || RETIRED_TARGET.includes(relation)) ? [targetId('99')] : [];
			const tenant = target.findColumnWithPropertyName('tenantId') ? { tenantId: TENANT } : {};
			for (const id of live) await insertRow(dataSource, target, { id, ...tenant });
			for (const id of retired) {
				await insertRow(dataSource, target, {
					id,
					...tenant,
					[target.deleteDateColumn.databaseName]: RETIRED_AT
				});
			}

			const tenantWide = index % 2 === 0 ? live.slice(0, 1) : [];
			await link(relation, TAGS.busy.id, [...live, ...retired]);
			await link(relation, TAGS.tenantWide.id, tenantWide);
			await link(relation, TAGS.retiredTargetsOnly.id, retired);
			// Tags the caller does not see, so their rows must not leak into anyone's counts
			for (const hidden of [TAGS.retiredTag, TAGS.systemTag, TAGS.otherTenant, TAGS.otherOrganization]) {
				await link(relation, hidden.id, live.slice(0, 1));
			}

			expected.set(counter, [live.length, tenantWide.length, 0]);
		}
		// The point of the retired targets: the relations given one are soft-deletable
		for (const relation of [...SEVERAL_TARGETS, ...RETIRED_TARGET]) {
			expect([
				relation,
				!!tagMetadata.findRelationWithPropertyPath(relation).inverseEntityMetadata.deleteDateColumn
			]).toEqual([relation, true]);
		}

		service = new TagService(repository as any, {} as any);
	}, ENTITY_GRAPH_TIMEOUT);

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		const original = actualGetConfig();
		jest.mocked(config.getConfig).mockReturnValue({
			...original,
			customFields: { ...original.customFields, Tag: [LABELS_FIELD] }
		} as unknown as ReturnType<typeof config.getConfig>);

		built = [];
		const createQueryBuilder = repository.createQueryBuilder.bind(repository);
		jest.spyOn(repository, 'createQueryBuilder').mockImplementation((alias?: string) => {
			const query = createQueryBuilder(alias);
			built.push(query);
			return query;
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.mocked(config.getConfig).mockImplementation(actualGetConfig);
	});

	it(
		'answers the same rows as the LEFT JOIN + GROUP BY query, without joining the counted relations',
		async () => {
			const result = await service.findTags(input);
			const [query] = built;
			const legacy = await legacyFindTags(repository, service, input);

			expect(result.total).toBe(legacy.total);
			expect(byId(result.items)).toStrictEqual(byId(legacy.items));
			// Same columns, in the same order
			expect(result.items.map((row) => Object.keys(row))).toStrictEqual(
				result.items.map((row) => Object.keys(legacy.items.find((other) => other.id === row.id)))
			);

			// The counted relations are subqueries now: no junction table is joined, nothing is grouped
			const sql = query.getQuery();
			expect(sql).not.toMatch(/JOIN "tag_task"/);
			expect(sql).not.toMatch(/GROUP BY/);
			expect(sql).toMatch(/FROM "tag_task" "tag_junction"/);
		},
		ENTITY_GRAPH_TIMEOUT
	);

	it(
		'counts the live targets of every relation and custom field, and only for the tags the caller sees',
		async () => {
			const { items, total } = await service.findTags(input);
			const rows = new Map<string, any>(items.map((row: any) => [row.id, row]));

			expect(total).toBe(4);
			expect([...rows.keys()].sort()).toEqual(
				[TAGS.busy, TAGS.tenantWide, TAGS.retiredTargetsOnly, TAGS.unused].map((tag) => tag.id).sort()
			);
			for (const [, counter] of counters) {
				const [busy, tenantWide, retiredOnly] = expected.get(counter);
				expect([counter, rows.get(TAGS.busy.id)[counter]]).toEqual([counter, busy]);
				expect([counter, rows.get(TAGS.tenantWide.id)[counter]]).toEqual([counter, tenantWide]);
				expect([counter, rows.get(TAGS.retiredTargetsOnly.id)[counter]]).toEqual([counter, retiredOnly]);
				expect([counter, rows.get(TAGS.unused.id)[counter]]).toEqual([counter, 0]);
			}
			expect(rows.get(TAGS.busy.id).tagTypeName).toBe('Priority');
			expect(rows.get(TAGS.tenantWide.id).tagTypeName).toBeNull();
			expect(rows.get(TAGS.busy.id).fullIconUrl).toEqual(expect.stringContaining('tags/busy.svg'));
		},
		ENTITY_GRAPH_TIMEOUT
	);

	it(
		'keeps one row per tag when the caller asks for to-many relations',
		async () => {
			const relations = ['tasks', 'employees', 'tagType'];
			const result = await service.findTags(input, relations);
			const legacy = await legacyFindTags(repository, service, input, relations);

			expect(result.total).toBe(4);
			expect(result.total).toBe(legacy.total);
			expect(byId(result.items)).toStrictEqual(byId(legacy.items));
			// The requested relations repeat a tag row per match; the GROUP BY folds them back as before
			expect(built[0].getQuery()).toMatch(/GROUP BY/);
		},
		ENTITY_GRAPH_TIMEOUT
	);

	it(
		'applies the name filter the same way',
		async () => {
			const filtered = { ...input, name: 'us' };
			const result = await service.findTags(filtered);
			const legacy = await legacyFindTags(repository, service, filtered);

			expect(byId(result.items).map((row) => row.name)).toEqual(['busy', 'unused']);
			expect(byId(result.items)).toStrictEqual(byId(legacy.items));
		},
		ENTITY_GRAPH_TIMEOUT
	);
});
