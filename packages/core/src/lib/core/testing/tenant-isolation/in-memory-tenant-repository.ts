import { DeleteResult, FindOperator, UpdateResult } from 'typeorm';
import { ID } from '@gauzy/contracts';

export type FakeRow = Record<string, any> & { id?: ID };

type Where = Record<string, any>;
type FindOptions = { where?: Where | Where[]; skip?: number; take?: number; withDeleted?: boolean };

/**
 * Minimal in-memory stand-in for a TypeORM `Repository<T>`, covering only the surface that
 * `CrudService` / `TenantAwareCrudService` actually call at runtime (`find*`, `count`, `create`,
 * `save`, `update`, `delete`, `softDelete`, and `metadata.hasColumnWithPropertyPath`).
 *
 * It exists so the shared tenant-isolation test harness (see `./tenant-isolation.assertions`) can
 * drive the REAL production service classes (`EmployeeService`, `OrganizationProjectService`, ...)
 * against representative seed data, without standing up a real SQL database. Row matching only
 * understands the where-shapes `TenantAwareCrudService` itself produces: a flat scalar column
 * (`{ tenantId: x }`), a one-level relation shorthand (`{ tenant: { id: x } }`) or `In(...)`
 * (`{ id: In(ids) }`, used by `deleteMany()` and the foreign-row guard); any other operator throws.
 * Like TypeORM, reads leave soft-deleted rows out unless `withDeleted` is passed. That is enough to
 * prove the tenant/organization scoping the class is responsible for, without reimplementing a query
 * planner.
 *
 * NOT a general-purpose TypeORM mock: it deliberately has no notion of joins, ordering, or
 * relations beyond the flat FK columns tenant isolation depends on.
 */
export class InMemoryTenantRepository<T extends FakeRow = FakeRow> {
	private readonly rows = new Map<ID, T>();
	private sequence = 0;

	constructor(
		private readonly columns: ReadonlySet<string>,
		seed: T[] = []
	) {
		seed.forEach((row) => this.seed(row));
	}

	/** Mirrors `Repository.metadata` just enough for the `hasColumnWithPropertyPath` checks that
	 *  `TenantAwareCrudService` uses to decide whether an entity is tenant/employee scoped at all. */
	readonly metadata = {
		tableName: 'in_memory_fixture',
		hasColumnWithPropertyPath: (path: string): boolean => this.columns.has(path)
	};

	/** Test-only helper: insert a row directly, bypassing all service-level scoping — this is how a
	 *  test plants "another tenant's" data without going through (and thus trusting) the code under test. */
	seed(row: T): T {
		const id = row.id ?? (`generated-${++this.sequence}` as unknown as ID);
		const stored = { ...row, id } as T;
		this.rows.set(id, stored);
		return stored;
	}

	/** Test-only helper: snapshot of every row currently stored, regardless of tenant. */
	all(): T[] {
		return [...this.rows.values()];
	}

	private matchesOne(row: T, where?: Where): boolean {
		if (!where) {
			return true;
		}
		return Object.entries(where).every(([key, value]) => {
			if (value instanceof FindOperator) {
				// `TenantAwareCrudService.deleteMany()` and `assertNotForeignRows()` look rows up by
				// `{ id: In(ids) }`. Compared as a plain value the operator matches no row: the bulk delete
				// becomes a silent no-op and the foreign-row guard never sees a foreign id. Any other
				// operator throws, so a query this fake cannot evaluate fails loudly instead of matching nothing.
				if (value.type !== 'in') {
					throw new Error(`InMemoryTenantRepository: unsupported operator "${value.type}" on "${key}"`);
				}
				return (value.value as unknown as unknown[]).includes(row[key]);
			}
			if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
				// Relation shorthand, e.g. `{ tenant: { id } }` -> compare against the flat FK column,
				// since fixture rows only ever carry the scalar `tenantId`/`organizationId` columns.
				return row[`${key}Id`] === (value as { id: unknown }).id;
			}
			return row[key] === value;
		});
	}

	/**
	 * Rows matching `where`. `excludeDeleted` is how the reads below mirror TypeORM on an entity with a
	 * delete-date column: a row `softDelete()` marked is left out unless the caller passes `withDeleted`
	 * (as `assertNotForeignRow` does). `update`/`delete`/`softDelete` keep seeing it, as TypeORM's do.
	 */
	private select(where?: Where | Where[], excludeDeleted = false): T[] {
		const clauses = Array.isArray(where) ? where : [where];
		return this.all().filter(
			(row) =>
				!(excludeDeleted && row.deletedAt != null) && clauses.some((clause) => this.matchesOne(row, clause))
		);
	}

	private selectForRead(options?: FindOptions): T[] {
		return this.select(options?.where, !options?.withDeleted);
	}

	async find(options?: FindOptions): Promise<T[]> {
		const matched = this.selectForRead(options);
		const skip = options?.skip ?? 0;
		const take = options?.take ?? matched.length;
		return matched.slice(skip, skip + take);
	}

	async findAndCount(options?: FindOptions): Promise<[T[], number]> {
		return [await this.find(options), this.selectForRead(options).length];
	}

	async count(options?: FindOptions): Promise<number> {
		return this.selectForRead(options).length;
	}

	async findOne(options?: FindOptions): Promise<T | null> {
		return this.selectForRead(options)[0] ?? null;
	}

	async findOneBy(where: Where): Promise<T | null> {
		return this.findOne({ where });
	}

	async findOneOrFail(options?: FindOptions): Promise<T> {
		const found = await this.findOne(options);
		if (!found) {
			throw new Error('EntityNotFoundError: no row matches the given criteria');
		}
		return found;
	}

	async findOneByOrFail(where: Where): Promise<T> {
		return this.findOneOrFail({ where });
	}

	/** TypeORM's `Repository.create` merely instantiates — it does not persist. */
	create(partial: Partial<T>): T {
		return { ...partial } as T;
	}

	async save(entity: Partial<T> | Array<Partial<T>>): Promise<T | T[]> {
		const list = Array.isArray(entity) ? entity : [entity];
		const saved = list.map((item) => {
			const id = (item as Partial<T>).id ?? (`generated-${++this.sequence}` as unknown as ID);
			const merged = { ...this.rows.get(id), ...item, id } as T;
			this.rows.set(id, merged);
			return merged;
		});
		return Array.isArray(entity) ? saved : saved[0];
	}

	async update(criteria: ID | Where, partial: Record<string, unknown>): Promise<UpdateResult> {
		const where = typeof criteria === 'object' ? criteria : { id: criteria };
		const matched = this.select(where);
		matched.forEach((row) => Object.assign(row, partial));
		return { affected: matched.length, raw: [], generatedMaps: [] } as UpdateResult;
	}

	async delete(criteria: ID | Where): Promise<DeleteResult> {
		const where = typeof criteria === 'object' ? criteria : { id: criteria };
		const matched = this.select(where);
		matched.forEach((row) => this.rows.delete(row.id as ID));
		return { affected: matched.length, raw: [] } as DeleteResult;
	}

	async softDelete(criteria: ID | Where): Promise<UpdateResult> {
		const where = typeof criteria === 'object' ? criteria : { id: criteria };
		const matched = this.select(where);
		matched.forEach((row) => ((row as FakeRow).deletedAt = new Date()));
		return { affected: matched.length, raw: [], generatedMaps: [] } as UpdateResult;
	}
}
