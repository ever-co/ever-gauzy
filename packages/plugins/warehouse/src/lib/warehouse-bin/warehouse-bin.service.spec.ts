/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a position service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * as the catalogue and inventory packages' service specs do, and **the service under test is the
 * real one**: only the base CRUD class, the request context and the entity base classes are
 * substituted.
 *
 * The base-class double mirrors `TenantAwareCrudService` where the behaviour is observable to a
 * caller: `create` answers with the saved row, `update` reaches the repository and answers with
 * TypeORM's `UpdateResult`, and a write against an id that is not there is a miss rather than a
 * silent no-op. **A criteria object that names a `version` is passed straight through**, exactly as
 * the real base class does: that column is a precondition the `UPDATE` evaluates, and a pre-read
 * would answer "not found" for a row that exists and has merely moved on.
 *
 * `commitVersionedUpdate` and `versionExpectationOf` are doubled here for the same reason the rest
 * of the barrel is. The contract reproduced is
 * `packages/core/src/lib/concurrency/versioned-write.ts`: the expected version is the one the caller
 * stated or, for a wildcard, the one the row reports; the write is one statement predicated on it;
 * and the affected-row count is the whole answer — one row means the record is now at the next
 * version, zero means it moved on or is gone, and the read-back decides which of the two the caller
 * is told about.
 */
jest.mock('@gauzy/core', () => {
	const { HttpException, HttpStatus, NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** A refusal that names its status and the catalogued code a caller branches on. */
	class VersionedWriteException extends HttpException {
		readonly code: string;
		readonly details?: Record<string, unknown>;

		constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
			super({ statusCode: status, error: 'Error', message }, status);
			this.code = code;
			this.details = details;
		}
	}

	/** The version a row reports, read as a positive integer or as nothing at all. */
	const parseEntityVersion = (value: unknown): number | null => {
		if (typeof value === 'number') {
			return Number.isInteger(value) && value > 0 ? value : null;
		}

		if (typeof value === 'string' && /^[0-9]+$/.test(value.trim())) {
			const version = Number(value.trim());

			return Number.isSafeInteger(version) && version > 0 ? version : null;
		}

		return null;
	};

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findOneByIdString(id: any): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({ where: { id } });

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			}

			// A criterion that names a version is a precondition rather than a locator, so it is not
			// pre-read: the statement itself is what decides, and reading first would report a row that
			// moved on as one that is gone.
			if (id && typeof id === 'object' && !('version' in id) && id.id) {
				await this.findOneByIdString(id.id);
			}

			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}
	}

	return {
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		User: class User {},
		Warehouse: class Warehouse {},
		SequenceService: class SequenceService {
			async allocate(): Promise<any> {
				throw new Error('no numbering series is configured in this double');
			}
		},
		versionExpectationOf: (request: any) => {
			const expectation = request?.['versionExpectation'];

			if (!expectation) {
				throw new VersionedWriteException(
					HttpStatus.PRECONDITION_REQUIRED,
					'VERSION_REQUIRED',
					'This write must state the version it was based on, and no version was accepted for it.'
				);
			}

			return expectation;
		},
		commitVersionedUpdate: async (service: any, options: any) => {
			const readCurrent =
				options.readVersion ??
				(async () => parseEntityVersion((await service.findOneByIdString(options.id))?.version));
			const expected =
				!options.expectation?.wildcard && options.expectation?.versions?.length === 1
					? options.expectation.versions[0]
					: parseEntityVersion(await readCurrent());

			if (expected === null) {
				throw new VersionedWriteException(HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND', 'The requested record was not found.', {
					id: options.id
				});
			}

			const nextVersion = expected + 1;
			const result = await service.update(
				{ ...(options.where ?? {}), id: options.id, version: expected },
				{ ...options.patch, version: nextVersion }
			);

			if (Number(result?.affected ?? 0) > 0) {
				return { version: nextVersion };
			}

			let actualVersion: number | null = null;
			let exists = true;

			try {
				const row = await service.findOneByIdString(options.id);

				actualVersion = parseEntityVersion(row?.version);
				exists = !!row;
			} catch (error) {
				exists = !(error instanceof NotFoundException);
			}

			if (!exists) {
				throw new VersionedWriteException(HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND', 'The requested record was not found.', {
					id: options.id
				});
			}

			throw new VersionedWriteException(
				HttpStatus.CONFLICT,
				'ENTITY_VERSION_CONFLICT',
				'The record changed since you read it. Read it again and reapply your change.',
				{ expectedVersion: expected, ...(actualVersion === null ? {} : { actualVersion }) }
			);
		},
		// The dialect helpers every closure statement is written through. The service imports them from
		// the barrel this factory replaces, and a name a factory does not answer for is `undefined` at
		// the call site — so the first descendant read would throw before it read anything. They are
		// doubled for the embedded dialect this suite runs against: a statement is left as it was
		// written, and a named parameter becomes the `?` both SQLite drivers bind, with the values in
		// the order the placeholders appear.
		prepareSQLQuery: (sql: string) => sql,
		toPositionalStatement: (sql: string, parameters: Record<string, unknown>) => {
			const values: unknown[] = [];
			const positional = sql.replace(/(?<!:):(\w+)\b/g, (match: string, name: string) => {
				if (!Object.prototype.hasOwnProperty.call(parameters ?? {}, name)) {
					return match;
				}

				values.push(parameters[name]);

				return '?';
			});

			return { sql: positional, parameters: values };
		},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			currentRequest: () => null,
			hasPermission: () => false
		}
	};
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import {
	IWarehouseStockLedgerPort,
	WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED,
	WarehouseBinType,
	WarehouseZoneType
} from '../warehouse.types';
import { addQuantities, normalizeQuantity, subtractQuantities, sumQuantities } from '../warehouse.quantity';
import { WarehouseBinService } from './warehouse-bin.service';

/**
 * The positions inside a location: the tree, the closure it is walked through, and the measurement
 * that keeps a request honest.
 *
 * Three properties of this service are worth a suite of their own, and they are the three the
 * specification states (doc 09 §14.2 rules 1–4, §14.3, §14.10, INV-25):
 *
 * - **the tree and its closure are written together**, so a descendant query never reports stock
 *   under the wrong rack: a bin is its own ancestor, every ancestor of its parent becomes its
 *   ancestor, and a re-parent rewrites the whole subtree rather than the node alone;
 * - **a position never changes location or zone** — moving physical shelving is modelled by
 *   deactivating the old position and creating a new one, so a historical pick keeps the address it
 *   walked — and a position a printed pick line names cannot be renamed;
 * - **a capacity is a quantity in a stated unit**: a write that declares one without the other is
 *   refused, a request entered in another unit is converted exactly before it is compared, and
 *   exceeding the ceiling is a warning the record carries rather than a refusal.
 *
 * The service is constructed directly over in-memory doubles of its two repositories. The bin double
 * implements the closure statements the service issues — the descendant walk, the ancestor walk, the
 * insert, the subtree delete and the printed-pick-line count — so the assertions below read the state
 * the tree is in rather than a call log, and `INV-25` is checked the way it is stated.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const OTHER_WAREHOUSE = '00000000-0000-4000-8000-000000000011';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000031';

/** The tables this package owns that this suite drives, as plain arrays. */
interface ITables {
	bin: any[];
	zone: any[];
	/** The closure table, as the pairs the service writes through raw statements. */
	closure: Array<{ id_ancestor: string; id_descendant: string }>;
	/** The lines a printed pick list holds, which is what makes a position's code immutable. */
	pickLine: any[];
}

/** A closure pair, as a string key, so a set comparison does not depend on insertion order. */
const pairKey = (pair: { id_ancestor: string; id_descendant: string }) =>
	`${pair.id_ancestor}->${pair.id_descendant}`;

/**
 * An in-memory stand-in for one table's TypeORM repository, including the raw statements the service
 * issues against the closure table and the pick lines.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository reads and writes.
 * @param writes Where the updates this repository receives are kept — the criteria the statement ran
 * with as well as the columns it wrote — so a test can tell a rewrite of a cached snapshot from a
 * write that did not happen, and can read the predicate a conditional write was made under.
 */
function repository(
	tables: ITables,
	tableName: 'bin' | 'zone',
	writes: Array<{ id: string; criteria: any; partial: any }> = []
) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: any, where: any = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				if (expected.type === 'in') {
					return (expected.value as any[]).map(String).includes(String(row[field] ?? ''));
				}

				throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}

			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const compare = (left: any, right: any): number => {
		const a = left instanceof Date ? left.getTime() : left;
		const b = right instanceof Date ? right.getTime() : right;

		if (typeof a === 'number' && typeof b === 'number') {
			return a - b;
		}

		return String(a ?? '') > String(b ?? '') ? 1 : -1;
	};
	const sorted = (found: any[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				if (compare(left[column], right[column]) === 0) {
					continue;
				}

				return compare(left[column], right[column]) * (order?.[column] === 'DESC' ? -1 : 1);
			}

			return 0;
		});
	};

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => sorted(rows().filter((row) => matches(row, options.where)), options.order),
		findOne: async (options: any = {}) => rows().find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: any) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async (options: any = {}) => rows().filter((row) => matches(row, options.where)).length,
		create: (partial: any) => ({ ...partial }),
		save: async (entity: any) => {
			if (entity.id) {
				const index = rows().findIndex((row) => row.id === entity.id);

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			// Generated ids carry an infix, so one can never collide with an id a fixture seeded.
			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		// The platform's `update` reaches TypeORM's own, which answers an `UpdateResult` and not the row.
		//
		// **Every member of the criteria is a predicate of the statement**, not just the id. A
		// conditional write states the version it was read at — and the tenant and organization the row
		// must belong to — in the same object, and a double that matched on the id alone would let a
		// write land that the database would have refused, which is the whole defect these criteria
		// exist to catch.
		update: async (criteria: any, partial: any) => {
			const where = typeof criteria === 'string' ? { id: criteria } : criteria ?? {};
			const index = rows().findIndex((row) => matches(row, where));

			writes.push({ id: where.id, criteria: where, partial });

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		/**
		 * The raw statements the service issues: the four closure reads and writes, and the count of
		 * printed pick lines that names the position. Anything else throws rather than answering wrongly.
		 */
		query: async (sql: string, params: any[] = []): Promise<any[]> => {
			if (/INSERT INTO "warehouse_bin_closure"/.test(sql)) {
				tables.closure.push({ id_ancestor: String(params[0]), id_descendant: String(params[1]) });

				return [];
			}

			if (/DELETE FROM "warehouse_bin_closure"/.test(sql)) {
				const removed = params.map(String);

				tables.closure = tables.closure.filter((pair) => !removed.includes(pair.id_descendant));

				return [];
			}

			if (/FROM "warehouse_bin_closure"/.test(sql)) {
				if (/"id_ancestor" = \? AND "id_descendant" = \?/.test(sql)) {
					return tables.closure
						.filter(
							(pair) =>
								pair.id_ancestor === String(params[0]) && pair.id_descendant === String(params[1])
						)
						.map((pair) => ({ id_ancestor: pair.id_ancestor }));
				}

				if (/"id_ancestor" = \?/.test(sql)) {
					return tables.closure
						.filter((pair) => pair.id_ancestor === String(params[0]))
						.map((pair) => ({ id_descendant: pair.id_descendant }));
				}

				if (/"id_descendant" = \?/.test(sql)) {
					return tables.closure
						.filter((pair) => pair.id_descendant === String(params[0]))
						.map((pair) => ({ id_ancestor: pair.id_ancestor }));
				}
			}

			if (/FROM "pick_list_line"/.test(sql)) {
				const total = tables.pickLine.filter(
					(line) => String(line.binId) === String(params[0]) && !line.deletedAt
				).length;

				return [{ total }];
			}

			throw new Error(`the in-memory double does not implement the statement "${sql}"`);
		}
	};
}

/** One `warehouse_bin` row, as the service reads it. */
const binRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	zoneId: 'zone-1',
	code: id.toUpperCase(),
	type: WarehouseBinType.SHELF,
	isPickable: true,
	isBlocked: false,
	sortOrder: 0,
	version: 1,
	...overrides
});

/** One `warehouse_zone` row: the service only ever resolves a position's area through it. */
const zoneRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	code: id.toUpperCase(),
	name: `Zone ${id}`,
	version: 1,
	...overrides
});

/** What the inventory capability is holding in a fixture. */
interface ILedgerSeed {
	/** The bins the ledger derives stock in, by variant: `binQuantity`, per bin. */
	placement?: Record<string, Record<string, string>>;
	/** The units the ledger holds at the location with no bin, by variant. */
	unplaced?: Record<string, string>;
	/** The level rows, by variant: the bin each declares as home and the quantity it holds. */
	levels?: Record<string, { binId?: string; quantity: string; reservedQuantity?: string }>;
}

/**
 * A stateful stand-in for the inventory capability the service reads balances from and states its
 * movements to.
 *
 * The ledger is the platform's record of what happened, so the double models it as one rather than as
 * a bag of answers. A relocation is applied to the placement it states — `TRANSFER_OUT` at the source
 * bin and `TRANSFER_IN` at the destination, equal and opposite, `reservedDelta = 0` on both, which is
 * the pair the provider writes — and a movement changes the level as well as the bin, which is exactly
 * why a count can never close a placement difference and why a second run over a corrected state is
 * the property that matters. The level's quantity and reservation are held apart from the placement so
 * a test can assert they were untouched (INV-27).
 *
 * @param seed What the ledger holds before the run.
 */
function ledger(seed: ILedgerSeed = {}) {
	const placement = new Map<string, Map<string, string>>();
	const unplaced = new Map<string, string>();
	const levels = new Map<string, { binId?: string; quantity: string; reservedQuantity: string }>();
	/** Every `recordMovement` the service asked for: the repair that can never converge. */
	const movements: Array<Record<string, unknown>> = [];
	/** Every `relocate` the service asked for, as it stated it. */
	const relocations: Array<Record<string, unknown>> = [];
	/** The two rows each relocation is written as, which is what INV-27 is asserted against. */
	const legs: Array<{
		movementId: string;
		binId: string;
		variantId: string;
		quantity: string;
		reservedDelta: string;
		referenceType: string;
		referenceId: string;
		reason?: string;
	}> = [];
	const asked: Array<Record<string, unknown>> = [];
	/** Every home-bin declaration the service asked for, as it stated it. */
	const declarations: Array<Record<string, unknown>> = [];
	/** Every put-away the service asked for, as it stated it. */
	const putAways: Array<Record<string, unknown>> = [];

	for (const [variantId, bins] of Object.entries(seed.placement ?? {})) {
		placement.set(
			variantId,
			new Map(Object.entries(bins).map(([binId, quantity]) => [binId, normalizeQuantity(quantity)]))
		);
	}

	for (const [variantId, quantity] of Object.entries(seed.unplaced ?? {})) {
		unplaced.set(variantId, normalizeQuantity(quantity));
	}

	for (const [variantId, level] of Object.entries(seed.levels ?? {})) {
		levels.set(variantId, {
			...(level.binId ? { binId: level.binId } : {}),
			quantity: normalizeQuantity(level.quantity),
			reservedQuantity: normalizeQuantity(level.reservedQuantity ?? '0')
		});
	}

	const binsOf = (variantId: string) => placement.get(variantId) ?? new Map<string, string>();
	const totalOf = (variantId: string) =>
		addQuantities(sumQuantities([...binsOf(variantId).values()]), unplaced.get(variantId) ?? '0');
	const recorded = (variantId: string) => placement.has(variantId) || unplaced.has(variantId);

	const port: IWarehouseStockLedgerPort = {
		readBinBalance: async (query) => {
			const variantId = String(query.variantId);
			const held = binsOf(variantId);

			if (query.binId) {
				const quantity = held.get(String(query.binId));

				return quantity === undefined
					? undefined
					: { variantId: query.variantId, binId: query.binId, quantity };
			}

			return recorded(variantId) ? { variantId: query.variantId, quantity: totalOf(variantId) } : undefined;
		},
		readBinBalances: async (binIds: any[]) => {
			const wanted = binIds.map(String);
			const rows: Array<{ binId: string; variantId: string; quantity: string }> = [];

			for (const [variantId, held] of placement) {
				for (const [binId, quantity] of held) {
					if (wanted.includes(binId)) {
						rows.push({ binId, variantId, quantity });
					}
				}
			}

			return rows;
		},
		readExpectedBinBalances: async (query) => {
			asked.push(query as Record<string, unknown>);
			const wanted = query.binIds.map(String);

			return [...levels]
				.filter(([, level]) => level.binId && wanted.includes(String(level.binId)))
				.map(([variantId, level]) => ({
					binId: level.binId as string,
					variantId,
					quantity: level.quantity
				}));
		},
		resolveHomeBin: async (query) => {
			const level = levels.get(String(query.variantId));

			return level
				? { ...(level.binId ? { binId: level.binId } : {}), quantity: level.quantity }
				: undefined;
		},
		recordMovement: async (request) => {
			movements.push(request as unknown as Record<string, unknown>);
			const variantId = String(request.variantId);
			const level = levels.get(variantId);

			// The provider moves the level and the bin by the same amount, and that is the whole
			// defect: a bin-tagged count changes both sides of the difference it was meant to close.
			if (level) {
				level.quantity = addQuantities(level.quantity, request.quantity);
			}

			if (request.binId) {
				const held = binsOf(variantId);

				held.set(
					String(request.binId),
					addQuantities(held.get(String(request.binId)) ?? '0', request.quantity)
				);
				placement.set(variantId, held);
			} else {
				unplaced.set(variantId, addQuantities(unplaced.get(variantId) ?? '0', request.quantity));
			}

			return { movementId: `movement-${movements.length}`, quantityAfter: level?.quantity ?? '0.000000' };
		},
		relocate: async (request) => {
			relocations.push(request as unknown as Record<string, unknown>);
			const variantId = String(request.variantId);
			const held = binsOf(variantId);
			const leaving = subtractQuantities('0', request.quantity);
			const pair: Array<{ binId: string; quantity: string; leg: string }> = [
				{ binId: String(request.fromBinId), quantity: leaving, leg: 'out' },
				{ binId: String(request.toBinId), quantity: request.quantity, leg: 'in' }
			];

			for (const move of pair) {
				held.set(move.binId, addQuantities(held.get(move.binId) ?? '0', move.quantity));
			}

			placement.set(variantId, held);

			return pair.map((move) => {
				const movementId = `relocation-${relocations.length}-${move.leg}`;

				legs.push({
					movementId,
					binId: move.binId,
					variantId,
					quantity: move.quantity,
					reservedDelta: '0.000000',
					referenceType: String(request.referenceType),
					referenceId: String(request.referenceId),
					reason: request.reason
				});

				return { movementId, quantityAfter: totalOf(variantId) };
			});
		},
		// A home-bin declaration, which writes the level row's own column and no movement.
		setHomeBin: async (request) => {
			declarations.push(request as unknown as Record<string, unknown>);
			const level = levels.get(String(request.variantId));

			if (!level) {
				return false;
			}

			level.binId = String(request.binId);

			return true;
		},
		// The walk received units take into a bin: the arrival, and the leg out of the position they were
		// recorded at, recorded against the document that asked for the walk.
		//
		// **The leg out is written whether or not a source bin was named.** A receipt records units at
		// the location with no address, so a walk that names no source bin leaves the unaddressed pool
		// rather than nothing: the pair nets to zero at the location, which is what stops a put-away from
		// crediting the same units a second time.
		putAway: async (request) => {
			putAways.push(request as unknown as Record<string, unknown>);
			const variantId = String(request.variantId);
			const level = levels.get(variantId);
			const legs: string[] = [];
			const leaving = subtractQuantities('0', request.quantity);

			if (request.fromBinId) {
				const held = binsOf(variantId);

				held.set(String(request.fromBinId), addQuantities(held.get(String(request.fromBinId)) ?? '0', leaving));
				placement.set(variantId, held);
				legs.push(`putaway-${putAways.length}-out`);
			} else {
				unplaced.set(variantId, addQuantities(unplaced.get(variantId) ?? '0', leaving));
				legs.push(`putaway-${putAways.length}-out`);
			}

			const held = binsOf(variantId);

			held.set(String(request.binId), addQuantities(held.get(String(request.binId)) ?? '0', request.quantity));
			placement.set(variantId, held);
			legs.push(`putaway-${putAways.length}-in`);

			if (level) {
				level.binId = String(request.binId);
			}

			return {
				transferOutMovementId: legs[0],
				transferInMovementId: legs[legs.length - 1],
				binId: String(request.binId),
				quantityAfter: totalOf(variantId)
			};
		}
	};

	return {
		port,
		movements,
		relocations,
		legs,
		asked,
		declarations,
		putAways,
		/** The level row as it stands, which no reconciliation may change. */
		level: (variantId: string) => levels.get(variantId),
		/** What the ledger derives for one bin of one variant. */
		held: (variantId: string, binId: string) => binsOf(variantId).get(binId) ?? '0.000000'
	};
}

/**
 * A stand-in for the kernel's location row.
 *
 * The service reads one thing from it — `metadata`, where a location states whether every unit must be
 * placed and which bin its unaddressed units sit in — so the double answers that read and nothing
 * else.
 *
 * @param warehouse The row, when the fixture has one.
 */
function locationRepository(warehouse?: { metadata?: Record<string, unknown> }) {
	return {
		findOne: async (options: any = {}) =>
			warehouse && String(options?.where?.id ?? WAREHOUSE) === WAREHOUSE
				? { id: WAREHOUSE, metadata: warehouse.metadata }
				: null,
		update: async () => ({ affected: 0 })
	};
}

/**
 * Builds the position service over in-memory doubles of its two repositories.
 *
 * @param options.bins The positions the fixture starts with.
 * @param options.zones The areas the fixture starts with.
 * @param options.closure The closure pairs the fixture starts with.
 * @param options.pickLines The printed pick lines the fixture starts with.
 * @param options.ledger What the inventory capability holds; absent means none is registered.
 * @param options.warehouse The location row, whose `metadata` carries a count's settings.
 */
function binFixture(
	options: {
		bins?: any[];
		zones?: any[];
		closure?: Array<{ id_ancestor: string; id_descendant: string }>;
		pickLines?: any[];
		ledger?: ILedgerSeed;
		warehouse?: { metadata?: Record<string, unknown> };
	} = {}
) {
	const tables: ITables = {
		bin: [...(options.bins ?? [])],
		zone: [...(options.zones ?? [zoneRow('zone-1')])],
		closure: [...(options.closure ?? [])],
		pickLine: [...(options.pickLines ?? [])]
	};
	const binWrites: Array<{ id: string; criteria: any; partial: any }> = [];
	const capability = options.ledger ? ledger(options.ledger) : undefined;
	const binRepository = repository(tables, 'bin', binWrites);
	const service = new WarehouseBinService(
		binRepository as never,
		{} as never,
		repository(tables, 'zone') as never,
		capability?.port as never,
		locationRepository(options.warehouse) as never
	);

	return {
		service,
		tables,
		capability,
		binWrites,
		/** The position repository itself, so a test can stage the reading a stale writer took. */
		binRepository,
		store: (id: string) => tables.bin.find((row) => row.id === id),
		ancestorsOf: (id: string): string[] =>
			tables.closure.filter((pair) => pair.id_descendant === id).map((pair) => pair.id_ancestor),
		descendantsOf: (id: string): string[] =>
			tables.closure.filter((pair) => pair.id_ancestor === id).map((pair) => pair.id_descendant),
		/** The closure as a set of pairs, for the "the old placement is gone" assertions. */
		pairs: (): string[] => tables.closure.map(pairKey)
	};
}

/**
 * A chain of positions, deepest last, each one parented to the one before it.
 *
 * @param ids The codes, in order from the root down.
 */
function chain(ids: string[]) {
	const bins: any[] = [];
	const closure: Array<{ id_ancestor: string; id_descendant: string }> = [];

	ids.forEach((id, index) => {
		bins.push(binRow(id, { parentId: index === 0 ? undefined : ids[index - 1], sortOrder: index }));
		closure.push({ id_ancestor: id, id_descendant: id });

		for (let above = index - 1; above >= 0; above--) {
			closure.push({ id_ancestor: ids[above], id_descendant: id });
		}
	});

	return { bins, closure };
}

describe('WarehouseBinService — creating a position and its place in the tree (doc 09 §14.2, INV-25)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a position with the documented defaults and records it as its own ancestor', async () => {
		// The self-pair is what makes a descendant query return the node itself, so "everything under
		// rack B" is one indexed join rather than a recursive walk with a special case at the root.
		const fixture = binFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'A-01'
		} as never);

		expect(created).toMatchObject({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'A-01',
			type: WarehouseBinType.SHELF,
			isPickable: true,
			isBlocked: false,
			sortOrder: 0,
			version: 1,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.ancestorsOf(created.id)).toEqual([created.id]);
		expect(fixture.descendantsOf(created.id)).toEqual([created.id]);
	});

	it('records every ancestor of the parent as an ancestor of the child', async () => {
		// The closure is written in the same call as the bin, so the tree and the table it is walked
		// through can never disagree — a closure that lags one write behind reports stock under the
		// wrong rack and nothing would say so.
		const { bins, closure } = chain(['root', 'child']);
		const fixture = binFixture({ bins, closure });

		const grandchild = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			parentId: 'child',
			code: 'GRANDCHILD'
		} as never);

		expect(new Set(fixture.ancestorsOf(grandchild.id))).toEqual(new Set([grandchild.id, 'child', 'root']));
		expect(new Set(fixture.descendantsOf('root'))).toEqual(new Set(['root', 'child', grandchild.id]));
	});

	it('keeps the type, pickability and order a caller states', async () => {
		const fixture = binFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'P-01',
			type: WarehouseBinType.PALLET,
			isPickable: false,
			isBlocked: true,
			sortOrder: 9
		} as never);

		expect(created).toMatchObject({
			type: WarehouseBinType.PALLET,
			isPickable: false,
			isBlocked: true,
			sortOrder: 9
		});
	});

	it('normalises the declared capacities to the storage scale', async () => {
		const fixture = binFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'P-01',
			capacityUnits: '1',
			capacityUnitId: 'unit-pallet',
			maxWeight: '480.5',
			maxWeightUnitId: 'unit-kg',
			maxVolume: '2',
			maxVolumeUnitId: 'unit-m3'
		} as never);

		expect(created).toMatchObject({
			capacityUnits: '1.000000',
			maxWeight: '480.500000',
			maxVolume: '2.000000'
		});
	});

	it('refuses a position that names no location, and one that carries no code', async () => {
		const fixture = binFixture();

		await expect(fixture.service.create({ zoneId: 'zone-1', code: 'A-01' } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		await expect(fixture.service.create({ warehouseId: WAREHOUSE, code: '' } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(fixture.tables.bin).toEqual([]);
		expect(fixture.tables.closure).toEqual([]);
	});

	it('refuses a code another position of the location already carries, and writes no closure row', async () => {
		const fixture = binFixture({ bins: [binRow('taken', { code: 'A-01' })] });

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, zoneId: 'zone-1', code: 'A-01' } as never)
		).rejects.toThrow(/already used by a bin/);
		expect(fixture.tables.bin).toHaveLength(1);
		expect(fixture.tables.closure).toEqual([]);
	});

	it('accepts the same code at another location', async () => {
		// Control: a code is unique inside a location, not inside the installation.
		const fixture = binFixture({
			bins: [binRow('taken', { code: 'A-01' })],
			zones: [zoneRow('zone-1'), zoneRow('zone-1-elsewhere', { warehouseId: OTHER_WAREHOUSE })]
		});

		const created = await fixture.service.create({
			warehouseId: OTHER_WAREHOUSE,
			zoneId: 'zone-1-elsewhere',
			code: 'A-01'
		} as never);

		expect(created.warehouseId).toBe(OTHER_WAREHOUSE);
		expect(fixture.tables.bin).toHaveLength(2);
	});

	it('refuses a position in an area that does not exist', async () => {
		const fixture = binFixture();

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, zoneId: 'no-such-zone', code: 'A-01' } as never)
		).rejects.toThrow(/zone named for this bin does not exist/);
		expect(fixture.tables.bin).toEqual([]);
	});

	it('refuses a position in an area of another location', async () => {
		const fixture = binFixture({ zones: [zoneRow('zone-1', { warehouseId: OTHER_WAREHOUSE })] });

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, zoneId: 'zone-1', code: 'A-01' } as never)
		).rejects.toThrow(/BIN_LOCATION_MISMATCH/);
		expect(fixture.tables.bin).toEqual([]);
	});

	it('refuses a parent that does not exist, one of another location and one of another area', async () => {
		// Nesting has to stay inside the area: a child under a rack of another zone would be reached by
		// two different walking orders at once.
		const fixture = binFixture({
			bins: [
				binRow('here'),
				binRow('elsewhere', { warehouseId: OTHER_WAREHOUSE }),
				binRow('other-zone', { zoneId: 'zone-2' })
			]
		});

		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				zoneId: 'zone-1',
				parentId: 'no-such-bin',
				code: 'A-01'
			} as never)
		).rejects.toThrow(/parent bin does not exist/);
		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				zoneId: 'zone-1',
				parentId: 'elsewhere',
				code: 'A-01'
			} as never)
		).rejects.toThrow(/BIN_LOCATION_MISMATCH/);
		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				zoneId: 'zone-1',
				parentId: 'other-zone',
				code: 'A-01'
			} as never)
		).rejects.toThrow(/only nest inside a bin of its own zone/);
		expect(fixture.tables.bin).toHaveLength(3);
	});

	it('refuses a capacity that does not declare the unit it is counted in', async () => {
		// A capacity is a quantity in a stated unit: a pallet position whose ceiling is `1` compared
		// against a request in pieces is either a wrong refusal or a wrong acceptance, and the unit
		// cannot be guessed (doc 09 §14.10, INV-28).
		const fixture = binFixture();

		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				zoneId: 'zone-1',
				code: 'P-01',
				type: WarehouseBinType.PALLET,
				capacityUnits: '1'
			} as never)
		).rejects.toThrow(/WAREHOUSE_BIN_CAPACITY_UNIT_REQUIRED/);
		expect(fixture.tables.bin).toEqual([]);

		const declared = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'P-01',
			type: WarehouseBinType.PALLET,
			capacityUnits: '1',
			capacityUnitId: 'unit-pallet'
		} as never);

		expect(declared).toMatchObject({ capacityUnits: '1.000000', capacityUnitId: 'unit-pallet' });
	});

	it('refuses a declared capacity of zero without a unit, and accepts a position with no capacity at all', async () => {
		// Boundary: `0` is a declared ceiling — an area that accepts nothing — so it is still a quantity
		// that needs its unit. No capacity at all is a different statement and needs nothing.
		const fixture = binFixture();

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, zoneId: 'zone-1', code: 'A-01', capacityUnits: 0 } as never)
		).rejects.toThrow(/WAREHOUSE_BIN_CAPACITY_UNIT_REQUIRED/);

		const unbounded = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'A-01'
		} as never);

		expect(unbounded.capacityUnits).toBeUndefined();
	});
});

describe('WarehouseBinService — creating a building by the rack (doc 09 §14.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('increments the trailing number and keeps the width it was written with', async () => {
		// The codes have to keep sorting the way the aisle is walked, so `A-01-09` is followed by
		// `A-01-10` rather than by `A-01-9`.
		const fixture = binFixture();

		const created = await fixture.service.createRange({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			from: 'A-01-09',
			count: 3
		});

		expect(created.map((bin) => bin.code)).toEqual(['A-01-09', 'A-01-10', 'A-01-11']);
		expect(created.map((bin) => bin.sortOrder)).toEqual([0, 1, 2]);
		expect(created.every((bin) => bin.type === WarehouseBinType.SHELF)).toBe(true);
	});

	it('starts the walk at the order the caller states', async () => {
		const fixture = binFixture();

		const created = await fixture.service.createRange({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			from: 'B-01',
			count: 2,
			sortOrder: 10
		});

		expect(created.map((bin) => bin.sortOrder)).toEqual([10, 11]);
	});

	it('creates exactly one position for a range of one, which is the shortest legal range', async () => {
		const fixture = binFixture();

		const created = await fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'A-1', count: 1 });

		expect(created.map((bin) => bin.code)).toEqual(['A-1']);
	});

	it('refuses a range of zero, of a negative count, of a fractional count and of no number to continue from', async () => {
		const fixture = binFixture();

		await expect(
			fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'A-01', count: 0 })
		).rejects.toThrow(/at least one bin/);
		await expect(
			fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'A-01', count: -1 })
		).rejects.toThrow(/at least one bin/);
		await expect(
			fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'A-01', count: 1.5 })
		).rejects.toThrow(/at least one bin/);
		await expect(
			fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'AISLE-A', count: 2 })
		).rejects.toThrow(/carries no number to continue from/);
		expect(fixture.tables.bin).toEqual([]);
	});

	it('refuses a range whose first code is already taken', async () => {
		const fixture = binFixture({ bins: [binRow('taken', { code: 'A-01' })] });

		await expect(
			fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'A-01', count: 2 })
		).rejects.toThrow(/already used by a bin/);
		expect(fixture.tables.bin).toHaveLength(1);
	});
});

describe('WarehouseBinService — the two facts a position may never change (doc 09 §14.2 rule 1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to move a position to another location', async () => {
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await expect(fixture.service.update('bin-1', { warehouseId: OTHER_WAREHOUSE } as never)).rejects.toThrow(
			/BIN_LOCATION_IMMUTABLE/
		);
		expect(fixture.store('bin-1')).toMatchObject({ warehouseId: WAREHOUSE, version: 1 });
	});

	it('refuses to move a position to another area, and accepts a restatement of its own area', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			zones: [zoneRow('zone-1'), zoneRow('zone-2')]
		});

		await expect(fixture.service.update('bin-1', { zoneId: 'zone-2' } as never)).rejects.toThrow(
			/BIN_LOCATION_IMMUTABLE/
		);
		expect(fixture.store('bin-1')).toMatchObject({ zoneId: 'zone-1', version: 1 });

		const updated = await fixture.service.update('bin-1', { zoneId: 'zone-1', sortOrder: 4 } as never);

		expect(updated).toMatchObject({ zoneId: 'zone-1', sortOrder: 4, version: 2 });
	});

	it('refuses a rename to a code another position of the location carries', async () => {
		const fixture = binFixture({ bins: [binRow('bin-1', { code: 'A-01' }), binRow('bin-2', { code: 'A-02' })] });

		await expect(fixture.service.update('bin-1', { code: 'A-02' } as never)).rejects.toThrow(
			/already used by a bin/
		);
		expect(fixture.store('bin-1')).toMatchObject({ code: 'A-01', version: 1 });
	});

	it('refuses a rename of a position a printed pick line already names', async () => {
		// The address as it was walked is what a historical pick keeps, which is why moving physical
		// shelving is modelled by deactivating the old position and creating a new one.
		const fixture = binFixture({
			bins: [binRow('bin-1', { code: 'A-01' })],
			pickLines: [
				{ id: 'line-1', binId: 'bin-1' },
				{ id: 'line-2', binId: 'bin-1' }
			]
		});

		await expect(fixture.service.update('bin-1', { code: 'A-09' } as never)).rejects.toThrow(
			/BIN_CODE_IMMUTABLE: 2 pick line/
		);
		expect(fixture.store('bin-1')).toMatchObject({ code: 'A-01', version: 1 });
	});

	it('accepts a rename of a position only deleted pick lines name', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1', { code: 'A-01' })],
			pickLines: [{ id: 'line-1', binId: 'bin-1', deletedAt: new Date() }]
		});

		const renamed = await fixture.service.update('bin-1', { code: 'A-09' } as never);

		expect(renamed).toMatchObject({ code: 'A-09', version: 2 });
	});

	it('lets a position whose capacity predates the unit column be edited for any other reason', async () => {
		// The migration leaves the unit null rather than guessing, and the capacity job asks the
		// operator for it; refusing every later edit of such a row would freeze it until then.
		const fixture = binFixture({ bins: [binRow('bin-1', { capacityUnits: '1.000000' })] });

		const updated = await fixture.service.update('bin-1', { sortOrder: 3 } as never);

		expect(updated).toMatchObject({ sortOrder: 3, capacityUnits: '1.000000', version: 2 });
	});

	it('refuses to change the capacity of such a position without declaring the unit at the same time', async () => {
		// The check is made against the row as it would stand, so stating one of the two fields is
		// stating the capacity.
		const fixture = binFixture({ bins: [binRow('bin-1', { capacityUnits: '1.000000' })] });

		await expect(fixture.service.update('bin-1', { capacityUnits: '2' } as never)).rejects.toThrow(
			/WAREHOUSE_BIN_CAPACITY_UNIT_REQUIRED/
		);
		expect(fixture.store('bin-1')).toMatchObject({ capacityUnits: '1.000000', version: 1 });

		const declared = await fixture.service.update('bin-1', {
			capacityUnits: '2',
			capacityUnitId: 'unit-pallet'
		} as never);

		expect(declared).toMatchObject({ capacityUnitId: 'unit-pallet', version: 2 });
		expect(Number(declared.capacityUnits)).toBe(2);
	});

	it('takes a position out of service and back without touching its address', async () => {
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await fixture.service.setBlocked('bin-1', true);

		expect(fixture.store('bin-1')).toMatchObject({ isBlocked: true, code: 'BIN-1', version: 2 });

		await fixture.service.setBlocked('bin-1', false);

		expect(fixture.store('bin-1')).toMatchObject({ isBlocked: false, version: 3 });
	});

	it('reports a position of another organization as missing', async () => {
		const fixture = binFixture({ bins: [binRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneScoped('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('WarehouseBinService — a position is written under the version it was read at (doc 09 §14.2 rule 1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('predicates the statement on the version it read, and on the row’s own tenant and organization', async () => {
		// The three writes on this service used to compute `version + 1` in application code and issue
		// it through the unconditional base updater, so the statement carried no predicate at all. What
		// is asserted here is the predicate itself: the version the service read, and the scope of the
		// row it read — not merely that the counter ended up one higher.
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await fixture.service.setBlocked('bin-1', true);

		expect(fixture.binWrites).toHaveLength(1);
		expect(fixture.binWrites[0].criteria).toEqual({
			id: 'bin-1',
			version: 1,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.binWrites[0].partial).toEqual({ isBlocked: true, version: 2 });
		expect(fixture.store('bin-1')).toMatchObject({ isBlocked: true, version: 2 });
	});

	it('refuses a rename made from a reading the position has already moved past, and keeps the write that won', async () => {
		// Two operators read position B at version 5. One blocks it; the other renames it from the copy
		// it read. Before the fix the second write landed unpredicated, erased the block and claimed the
		// same version the first write had claimed — so a client holding an entity tag of that version
		// read a row neither write had produced, and no conflict was ever reported.
		const fixture = binFixture({ bins: [binRow('bin-1', { version: 5 })] });
		const readAtFive = { ...fixture.store('bin-1') };

		await fixture.service.setBlocked('bin-1', true);
		expect(fixture.store('bin-1')).toMatchObject({ isBlocked: true, version: 6 });

		// The second operator's edit, computed against the reading it took at version 5.
		jest.spyOn(fixture.binRepository, 'findOne').mockResolvedValueOnce(readAtFive as never);

		await expect(fixture.service.update('bin-1', { code: 'A-02-07' } as never)).rejects.toMatchObject({
			code: 'ENTITY_VERSION_CONFLICT'
		});

		// The block stands, the rename did not land, and the counter moved exactly once.
		expect(fixture.store('bin-1')).toMatchObject({ isBlocked: true, code: 'BIN-1', version: 6 });
	});

	it('refuses a re-parent made from a stale reading, and leaves the tree where the write that won put it', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1', { version: 3 }), binRow('parent', { version: 1 })],
			closure: [
				{ id_ancestor: 'bin-1', id_descendant: 'bin-1' },
				{ id_ancestor: 'parent', id_descendant: 'parent' }
			]
		});
		const readAtThree = { ...fixture.store('bin-1') };

		await fixture.service.setBlocked('bin-1', true);
		expect(fixture.store('bin-1')).toMatchObject({ version: 4 });

		jest.spyOn(fixture.binRepository, 'findOne').mockResolvedValueOnce(readAtThree as never);

		await expect(fixture.service.reparent('bin-1', 'parent')).rejects.toMatchObject({
			code: 'ENTITY_VERSION_CONFLICT'
		});

		// A refused move rewrites no closure row either: the subtree is still where it was.
		//
		// The parent is asserted as a value rather than through `toMatchObject`, which distinguishes a
		// property that is present and `undefined` from one that is absent — a distinction the row's
		// shape now turns on and the claim never did. What is being said is that the bin has no parent.
		expect(fixture.store('bin-1').parentId).toBeUndefined();
		expect(fixture.store('bin-1')).toMatchObject({ version: 4 });
		expect(fixture.pairs().sort()).toEqual(['bin-1->bin-1', 'parent->parent']);
	});

	it('refuses a write against a position another writer has deleted', async () => {
		const fixture = binFixture({ bins: [binRow('bin-1')] });
		const readBeforeDelete = { ...fixture.store('bin-1') };

		fixture.tables.bin = [];
		jest.spyOn(fixture.binRepository, 'findOne').mockResolvedValueOnce(readBeforeDelete as never);

		await expect(fixture.service.setBlocked('bin-1', true)).rejects.toMatchObject({
			code: 'RESOURCE_NOT_FOUND'
		});
	});
});

describe('WarehouseBinService — re-parenting a subtree (doc 09 §14.2 rule 2, INV-25)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('moves the subtree under the new parent and drops the old chain', async () => {
		// The closure describes where the subtree is *now*: a descendant query under the old root that
		// still returned the moved rack would report stock under a rack it left.
		const moved = chain(['left', 'leaf']);
		const target = chain(['right']);
		const fixture = binFixture({
			bins: [...moved.bins, ...target.bins],
			closure: [...moved.closure, ...target.closure]
		});

		await fixture.service.reparent('left', 'right');

		expect(fixture.store('left')).toMatchObject({ parentId: 'right', version: 2 });
		expect(new Set(fixture.ancestorsOf('left'))).toEqual(new Set(['left', 'right']));
		expect(new Set(fixture.descendantsOf('right'))).toEqual(new Set(['right', 'left', 'leaf']));
		// The chain above the moved rack is gone, and no pair is stored twice: a node with two parents'
		// worth of ancestors is a node two descendant queries disagree about.
		expect(fixture.pairs()).toHaveLength(new Set(fixture.pairs()).size);
		// `left->leaf` is a pair *inside* the subtree: the shelf is still a descendant of the rack it
		// moved with, so the re-parent rewrites the placement and leaves the interior alone. Every other
		// pair is the moved subtree's new ancestry — the old one (`left` under nothing) is gone.
		expect(new Set(fixture.pairs())).toEqual(
			new Set(['right->right', 'left->left', 'leaf->leaf', 'left->leaf', 'right->left', 'right->leaf'])
		);
	});

	// The defect: `relinkClosure` removes every closure row that described the subtree, then writes back
	// only the self-pairs of its members and the pairs that tie them to the new parent's ancestry. The
	// ancestry *inside* the subtree — the pairs that made a shelf a descendant of its own rack — is
	// removed and never rewritten, so after a single re-parent `descendantIds` answers a rack alone and
	// the shelf below it has become invisible to every subtree query.
	// (`warehouse-bin.service.ts`, the `pairs` initialiser in `relinkClosure`, line 814: the subtree's
	// own internal pairs are the ones missing.)
	it('[DEFECT] keeps the ancestry inside the subtree it moved', async () => {
		const moved = chain(['left', 'leaf']);
		const target = chain(['right']);
		const fixture = binFixture({
			bins: [...moved.bins, ...target.bins],
			closure: [...moved.closure, ...target.closure]
		});

		await fixture.service.reparent('left', 'right');

		expect(new Set(fixture.ancestorsOf('leaf'))).toEqual(new Set(['leaf', 'left', 'right']));
		expect(new Set(fixture.descendantsOf('left'))).toEqual(new Set(['left', 'leaf']));
	});

	it('makes a position a root when it is moved to no parent', async () => {
		const { bins, closure } = chain(['root', 'child', 'leaf']);
		const fixture = binFixture({ bins, closure });

		await fixture.service.reparent('child', null);

		expect(fixture.store('child')).toMatchObject({ parentId: null, version: 2 });
		// Nothing above the lifted position reaches it any more.
		expect(fixture.descendantsOf('root')).toEqual(['root']);
		expect(new Set(fixture.ancestorsOf('child'))).toEqual(new Set(['child']));
	});

	// The same defect reached from the other direction: lifting a subtree to a root is a re-parent, so
	// it loses the pairs that made the leaf a descendant of the position that was lifted.
	it('[DEFECT] keeps the ancestry inside the subtree it lifted to a root', async () => {
		const { bins, closure } = chain(['root', 'child', 'leaf']);
		const fixture = binFixture({ bins, closure });

		await fixture.service.reparent('child', null);

		expect(new Set(fixture.descendantsOf('child'))).toEqual(new Set(['child', 'leaf']));
		expect(new Set(fixture.ancestorsOf('leaf'))).toEqual(new Set(['leaf', 'child']));
	});

	it('is idempotent: re-parenting the same subtree twice leaves the same closure', async () => {
		const moved = chain(['left', 'leaf']);
		const target = chain(['right']);
		const fixture = binFixture({
			bins: [...moved.bins, ...target.bins],
			closure: [...moved.closure, ...target.closure]
		});

		await fixture.service.reparent('left', 'right');
		const once = [...fixture.pairs()].sort();

		await fixture.service.reparent('left', 'right');

		expect([...fixture.pairs()].sort()).toEqual(once);
	});

	it('refuses to make a position its own parent', async () => {
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await expect(fixture.service.reparent('bin-1', 'bin-1')).rejects.toThrow(/BIN_HIERARCHY_CYCLE/);
		expect(fixture.store('bin-1')).toMatchObject({ version: 1 });
	});

	it('refuses a target of another area', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('other-zone', { zoneId: 'zone-2' })],
			zones: [zoneRow('zone-1'), zoneRow('zone-2')]
		});

		await expect(fixture.service.reparent('bin-1', 'other-zone')).rejects.toThrow(/own zone/);
		expect(fixture.store('bin-1')).toMatchObject({ version: 1 });
	});

	it('refuses a target inside the position’s own subtree and rewrites nothing', async () => {
		// The move would make the ancestor chain a cycle, and every later descendant query would walk
		// it forever.
		const { bins, closure } = chain(['root', 'child', 'leaf']);
		const fixture = binFixture({ bins, closure });
		const before = [...fixture.pairs()].sort();

		await expect(fixture.service.reparent('root', 'leaf')).rejects.toThrow(/BIN_HIERARCHY_CYCLE/);
		await expect(fixture.service.reparent('child', 'leaf')).rejects.toThrow(/BIN_HIERARCHY_CYCLE/);
		expect(fixture.store('root')).toMatchObject({ version: 1 });
		expect(fixture.store('child')).toMatchObject({ version: 1 });
		expect([...fixture.pairs()].sort()).toEqual(before);
	});

	it('accepts a move that lands exactly on the documented depth limit', async () => {
		// The limit is five levels, counted from the root at depth zero: a subtree three levels high
		// under a parent at depth one puts its deepest position at depth four, which is the deepest a
		// position may sit at. The move is accepted rather than refused, which is the boundary.
		const deep = chain(['a0', 'a1', 'a2']);
		const branch = chain(['b0', 'b1']);
		const fixture = binFixture({ bins: [...deep.bins, ...branch.bins], closure: [...deep.closure, ...branch.closure] });

		await fixture.service.reparent('a0', 'b1');

		expect(fixture.store('a0')).toMatchObject({ parentId: 'b1', version: 2 });
		expect(new Set(fixture.ancestorsOf('a0'))).toEqual(new Set(['a0', 'b1', 'b0']));
	});

	it('refuses a move that would put a position one level past the limit', async () => {
		// One past the boundary above: a subtree three levels high under a parent already at depth two
		// would reach depth five.
		const deep = chain(['a0', 'a1', 'a2']);
		const branch = chain(['b0', 'b1', 'b2']);
		const fixture = binFixture({ bins: [...deep.bins, ...branch.bins], closure: [...deep.closure, ...branch.closure] });

		await expect(fixture.service.reparent('a0', 'b2')).rejects.toThrow(/BIN_HIERARCHY_TOO_DEEP/);
		expect(fixture.store('a0')).toMatchObject({ parentId: undefined, version: 1 });
	});

	it('refuses to nest a new position past the limit as well', async () => {
		// The same bound holds on the way in: a position created under the deepest allowed parent would
		// sit one level too far down.
		const { bins, closure } = chain(['d0', 'd1', 'd2', 'd3', 'd4']);
		const fixture = binFixture({ bins, closure });

		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				zoneId: 'zone-1',
				parentId: 'd4',
				code: 'DEEP'
			} as never)
		).rejects.toThrow(/BIN_HIERARCHY_TOO_DEEP/);
		expect(fixture.tables.bin).toHaveLength(5);
	});
});

describe('WarehouseBinService — where a variant is kept, and the walk that puts it there (doc 09 §14.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const placementFixture = () =>
		binFixture({
			bins: [
				binRow('receiving', { code: 'REC', isPickable: false, type: WarehouseBinType.DOCK }),
				binRow('target', { code: 'A-01', isPickable: true }),
				binRow('blocked', { code: 'B-01', isBlocked: true })
			],
			zones: [zoneRow('zone-1')],
			ledger: { levels: { variant: { binId: 'receiving', quantity: '10.000000', reservedQuantity: '0.000000' } } }
		});

	it('declares a bin as the home bin without writing a movement', async () => {
		// A declaration, not a move: nothing physically changed, so the ledger writes no row and the level
		// row's own column is what reconciliation later measures the placement against.
		const fixture = placementFixture();

		const assigned = await fixture.service.assignHomeBin('target', {
			variantId: 'variant',
			warehouseId: WAREHOUSE
		});

		expect(assigned).toBe(true);
		expect(fixture.capability?.declarations).toEqual([
			{ warehouseId: WAREHOUSE, variantId: 'variant', binId: 'target' }
		]);
		expect(fixture.capability?.movements).toEqual([]);
		expect(fixture.capability?.putAways).toEqual([]);
		expect(fixture.capability?.level('variant')?.binId).toBe('target');
	});

	it('refuses to declare a bin of another location as the home bin of a level at this one', async () => {
		// The movement path refuses exactly this — `resolveBin` answers `BIN_LOCATION_MISMATCH` for a bin
		// that belongs to another location — but a declaration writes no movement and so never reached
		// that guard. The level row of one building could be pointed at a position standing in another,
		// the write succeeded, and the pick generated from that level sent a picker to an address that is
		// not in their building; reconciliation could never report it closed either, because a bin outside
		// the location can never be in the partition a run over that location walks.
		const fixture = binFixture({
			bins: [binRow('target', { code: 'A-01' }), binRow('elsewhere', { code: 'X-01', warehouseId: OTHER_WAREHOUSE })],
			ledger: { levels: { variant: { quantity: '10.000000' } } }
		});

		await expect(
			fixture.service.assignHomeBin('elsewhere', { variantId: 'variant', warehouseId: WAREHOUSE })
		).rejects.toThrow(/^BIN_LOCATION_MISMATCH/);
		expect(fixture.capability?.declarations).toEqual([]);

		// The same declaration against a position of the stated location is written.
		await expect(
			fixture.service.assignHomeBin('target', { variantId: 'variant', warehouseId: WAREHOUSE })
		).resolves.toBe(true);
		expect(fixture.capability?.declarations).toEqual([
			{ warehouseId: WAREHOUSE, variantId: 'variant', binId: 'target' }
		]);
	});

	it('walks received units into a bin, and refuses a declaration with no variant to declare', async () => {
		const fixture = placementFixture();

		const walked = await fixture.service.putAway('target', {
			variantId: 'variant',
			warehouseId: WAREHOUSE,
			quantity: '4',
			fromBinId: 'receiving',
			stockMovementId: 'movement-receipt'
		});

		expect(walked.binId).toBe('target');
		expect(walked.transferOutMovementId).toBeDefined();
		// The walk is recorded against the movement the units were received by, which is what makes the
		// put-away explainable from the receipt rather than from a document of its own.
		expect(fixture.capability?.putAways).toEqual([
			{
				warehouseId: WAREHOUSE,
				variantId: 'variant',
				binId: 'target',
				quantity: '4',
				fromBinId: 'receiving',
				stockMovementId: 'movement-receipt',
				referenceType: 'PUTAWAY',
				referenceId: 'movement-receipt'
			}
		]);
		expect(fixture.capability?.held('variant', 'target')).toBe('4.000000');
		expect(fixture.capability?.level('variant')?.binId).toBe('target');

		// A declaration that names no variant has nothing to be about, and is refused before the ledger is
		// asked to write anything.
		await expect(fixture.service.assignHomeBin('target', { warehouseId: WAREHOUSE } as never)).rejects.toThrow(
			/variantId/
		);
		expect(fixture.capability?.declarations).toEqual([]);
	});

	it('refuses to place units in a position that is out of service', async () => {
		const fixture = placementFixture();

		await expect(
			fixture.service.putAway('blocked', { variantId: 'variant', warehouseId: WAREHOUSE, quantity: '1' })
		).rejects.toThrow(/^BIN_BLOCKED/);
		expect(fixture.capability?.putAways).toEqual([]);
	});
});

describe('WarehouseBinService — reading the building (doc 09 §14.2, §14.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const readFixture = () =>
		binFixture({
			bins: [
				binRow('second', { code: 'B', sortOrder: 1, isPickable: true }),
				binRow('first', { code: 'A', sortOrder: 1, isPickable: true }),
				binRow('earlier', { code: 'Z', sortOrder: 0, isPickable: true }),
				binRow('blocked', { code: 'C', sortOrder: 2, isPickable: true, isBlocked: true }),
				binRow('grouping', { code: 'D', sortOrder: 3, isPickable: false }),
				binRow('other-area', { code: 'E', zoneId: 'zone-2', sortOrder: 0, isPickable: true }),
				binRow('elsewhere', {
					code: 'F',
					zoneId: 'zone-9',
					warehouseId: OTHER_WAREHOUSE,
					sortOrder: 0,
					isPickable: true
				})
			],
			zones: [zoneRow('zone-1'), zoneRow('zone-2')]
		});

	it('returns exactly the positions a picker may walk to, in walking order', async () => {
		// Order first, then the code — so a shared order is still a reproducible walk. A blocked
		// position and a grouping position are excluded, because neither holds allocation-visible
		// stock; which *areas* are part of the walk is the zone service's answer, so a position of
		// another area of the same location is still a position of this location.
		const fixture = readFixture();

		expect((await fixture.service.findPickableBins(WAREHOUSE)).map((bin) => bin.id)).toEqual([
			'other-area',
			'earlier',
			'first',
			'second'
		]);
	});

	it('narrows the walk to one area when the caller names one', async () => {
		const fixture = readFixture();

		expect((await fixture.service.findPickableBins(WAREHOUSE, 'zone-2')).map((bin) => bin.id)).toEqual([
			'other-area'
		]);
	});

	it('reads every position of an area, including the ones that may not be picked from', async () => {
		// This is the read a count and a capacity plan use, so it is scoped by area rather than by
		// pickability, and a position of the same area at another location does not appear.
		const fixture = readFixture();

		expect((await fixture.service.findInZone('zone-1')).map((bin) => bin.id)).toEqual([
			'earlier',
			'first',
			'second',
			'blocked',
			'grouping'
		]);
	});

	it('reads a whole area as a forest with each node’s children attached', async () => {
		const { bins, closure } = chain(['rack', 'shelf', 'slot']);
		const fixture = binFixture({ bins: [...bins, binRow('free', { code: 'Z-FREE', sortOrder: 5 })], closure });

		const roots = await fixture.service.findTree(WAREHOUSE);

		expect(roots.map((bin) => bin.id)).toEqual(['rack', 'free']);
		expect(roots[0].children.map((bin: any) => bin.id)).toEqual(['shelf']);
		expect(roots[0].children[0].children.map((bin: any) => bin.id)).toEqual(['slot']);
		expect(roots[1].children).toEqual([]);
	});

	it('reads a subtree from the closure, itself included', async () => {
		const { bins, closure } = chain(['rack', 'shelf', 'slot']);
		const fixture = binFixture({ bins: [...bins, binRow('free')], closure });

		expect(new Set((await fixture.service.findSubtree('rack')).map((bin) => bin.id))).toEqual(
			new Set(['rack', 'shelf', 'slot'])
		);
		// A leaf is a subtree of one, which is what the self-pair buys.
		expect((await fixture.service.findSubtree('slot')).map((bin) => bin.id)).toEqual(['slot']);
	});

	it('refuses to derive the contents of a position when no inventory capability is registered', async () => {
		// A tenant that has not adopted the ledger can still maintain zones and positions; what it
		// cannot do is have a balance derived, and the refusal says so rather than answering zero.
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await expect(fixture.service.findContents('bin-1')).rejects.toThrow(/WAREHOUSE_STOCK_LEDGER_UNAVAILABLE/);
	});

	it('derives the contents of a position from the ledger, never from a column here', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('bin-2')],
			ledger: {
				placement: {
					[VARIANT]: { 'bin-1': '7.000000', 'bin-2': '99.000000' },
					[OTHER_VARIANT]: { 'bin-1': '3.000000' }
				}
			}
		});

		expect(await fixture.service.findContents('bin-1')).toEqual([
			{ binId: 'bin-1', variantId: VARIANT, quantity: '7.000000' },
			{ binId: 'bin-1', variantId: OTHER_VARIANT, quantity: '3.000000' }
		]);
		// Nothing is stored on the position itself: two writers of one level is how a level drifts.
		expect(fixture.store('bin-1').quantity).toBeUndefined();
	});
});

describe('WarehouseBinService — deleting a position (doc 09 §14.2 rule 4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to delete a position that still holds positions under it', async () => {
		// The foreign key from a child is the bin itself, so deleting a rack would leave its shelves
		// parented to nothing.
		const { bins, closure } = chain(['rack', 'shelf']);
		const fixture = binFixture({ bins, closure, ledger: {} });

		await expect(fixture.service.delete('rack')).rejects.toThrow(/BIN_HAS_CHILDREN: the bin still holds 1/);
		expect(fixture.tables.bin).toHaveLength(2);
	});

	it('refuses to delete a position whose derived balance is not zero', async () => {
		// The check is the point of the method: deleting a position that holds stock would erase where
		// the stock was, and blocking it is the operation the operator actually wants.
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			ledger: { placement: { [VARIANT]: { 'bin-1': '-0.000001' } } }
		});

		await expect(fixture.service.delete('bin-1')).rejects.toThrow(/BIN_HAS_CONTENT/);
		expect(fixture.tables.bin).toHaveLength(1);
	});

	it('deletes an empty position that holds nothing under it and takes its closure rows with it', async () => {
		const { bins, closure } = chain(['rack', 'shelf']);
		const fixture = binFixture({
			bins,
			closure,
			ledger: { placement: { [VARIANT]: { shelf: '0.000000' } } }
		});

		await expect(fixture.service.delete('shelf')).resolves.toMatchObject({ affected: 1 });

		expect(fixture.tables.bin.map((bin) => bin.id)).toEqual(['rack']);
		expect(fixture.pairs()).toEqual(['rack->rack']);
	});

	it('deletes a position the ledger holds no balance row for at all', async () => {
		// Control for the guard above: with a ledger registered and no rows for the position, the
		// derived contents are empty and the delete proceeds.
		const fixture = binFixture({ bins: [binRow('bin-1')], ledger: {} });

		expect(await fixture.service.findContents('bin-1')).toEqual([]);
		await expect(fixture.service.delete('bin-1')).resolves.toMatchObject({ affected: 1 });
	});
});

describe('WarehouseBinService — a capacity is a quantity in a stated unit (doc 09 §14.10, INV-28)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const capacityFixture = (overrides: Record<string, unknown> = {}) =>
		binFixture({ bins: [binRow('bin-1', { type: WarehouseBinType.PALLET, ...overrides })] });

	it('answers a position that declares no capacity with nothing to compare', async () => {
		const fixture = capacityFixture();

		const check = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '480' });

		expect(check).toMatchObject({ binId: 'bin-1', requestedQuantity: '480.000000', exceeded: false, notices: [] });
		expect(check.capacityUnits).toBeUndefined();
		expect(check.requestedInCapacityUnit).toBeUndefined();
	});

	it('reports a capacity declared without its unit and converts nothing', async () => {
		// Converting into an undeclared unit would be a guess dressed as a measurement, so the operator
		// is asked instead (INV-28).
		const fixture = capacityFixture({ capacityUnits: '1.000000' });

		const check = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '480', unitId: 'unit-piece' });

		expect(check).toMatchObject({
			capacityUnits: '1.000000',
			requestedQuantity: '480.000000',
			requestedUnitId: 'unit-piece',
			exceeded: false,
			notices: [WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED]
		});
		expect(check.requestedInCapacityUnit).toBeUndefined();
	});

	it('converts a request in another unit through the stated factor and compares the exact result', async () => {
		// The factor is how many of the capacity's unit one of the request's unit is — here a position
		// whose ceiling is one pallet, against a request counted in pairs.
		const fixture = capacityFixture({ capacityUnits: '1', capacityUnitId: 'unit-pallet' });

		const at = await fixture.service.checkCapacity({
			binId: 'bin-1',
			quantity: '2',
			unitId: 'unit-pair',
			conversionFactor: '0.5'
		});

		expect(at.requestedInCapacityUnit).toBe('1.000000');
		expect(at.exceeded).toBe(false);
		expect(at.notices).toEqual([]);

		const past = await fixture.service.checkCapacity({
			binId: 'bin-1',
			quantity: '3',
			unitId: 'unit-pair',
			conversionFactor: '0.5'
		});

		expect(past.requestedInCapacityUnit).toBe('1.500000');
		expect(past.exceeded).toBe(true);
		expect(past.remainingQuantity).toBe('-0.500000');
	});

	it('answers the boundary the way the ceiling reads: exactly on it is not past it, one unit past it is', async () => {
		const fixture = capacityFixture({ capacityUnits: '10', capacityUnitId: 'unit-piece' });

		const at = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '10' });
		const past = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '10.000001' });

		expect(at).toMatchObject({ exceeded: false, remainingQuantity: '0.000000', notices: [] });
		expect(past).toMatchObject({
			exceeded: true,
			remainingQuantity: '-0.000001',
			notices: ['WAREHOUSE_BIN_CAPACITY_EXCEEDED']
		});
	});

	it('compares without floating point drift at the scale where it would matter', async () => {
		// `0.1 × 3` is `0.30000000000000004` as a double, so a comparison made on floats answers "past
		// the ceiling" for a request that is exactly on it. The conversion is taken at twice the
		// storage scale and quantised back once, so the answer is the measurement rather than the
		// representation.
		const fixture = capacityFixture({ capacityUnits: '0.3', capacityUnitId: 'unit-litre' });

		const check = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '0.1', conversionFactor: '3' });

		expect(check).toMatchObject({ requestedInCapacityUnit: '0.300000', exceeded: false, remainingQuantity: '0.000000' });
		expect(0.1 * 3 > 0.3).toBe(true);
	});

	it('rounds a converted quantity half away from zero, in both directions', async () => {
		// The seventh decimal of a converted quantity decides the comparison, and rounding towards zero
		// would let a request that is over the ceiling answer as though it were under it.
		const fixture = capacityFixture({ capacityUnits: '1', capacityUnitId: 'unit-piece' });

		const positive = await fixture.service.checkCapacity({
			binId: 'bin-1',
			quantity: '1',
			conversionFactor: '0.0000005'
		});
		const negative = await fixture.service.checkCapacity({
			binId: 'bin-1',
			quantity: '-1',
			conversionFactor: '0.0000005'
		});

		expect(positive.requestedInCapacityUnit).toBe('0.000001');
		expect(negative.requestedInCapacityUnit).toBe('-0.000001');
	});

	it('normalises the requested quantity at the storage scale before it converts it', async () => {
		// A quantity written with more precision than a column holds compares the way the column will
		// store it, which is what makes the check reproducible against the record.
		const fixture = capacityFixture({ capacityUnits: '1', capacityUnitId: 'unit-piece' });

		const check = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '2.0000004' });

		expect(check.requestedQuantity).toBe('2.000000');
		expect(check.exceeded).toBe(true);
	});

	it('treats a negative request as below the ceiling and reports the room it leaves', async () => {
		// Boundary: a correction can be stated as a negative quantity, and it is a measurement like any
		// other — the ceiling is not a floor.
		const fixture = capacityFixture({ capacityUnits: '5', capacityUnitId: 'unit-piece' });

		const check = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '-2' });

		expect(check).toMatchObject({ requestedInCapacityUnit: '-2.000000', remainingQuantity: '7.000000', exceeded: false });
	});

	it('lists the positions whose capacity has no unit, pallet positions first and then by code', async () => {
		// The ambiguity is operational rather than theoretical for a pallet position, so those are the
		// ones the operator is asked about first.
		const fixture = binFixture({
			bins: [
				binRow('shelf-b', { code: 'B-02', capacityUnits: '50.000000' }),
				binRow('pallet-b', { code: 'P-02', type: WarehouseBinType.PALLET, capacityUnits: '1.000000' }),
				binRow('pallet-a', { code: 'P-01', type: WarehouseBinType.PALLET, capacityUnits: '1.000000' }),
				binRow('declared', { code: 'A-01', capacityUnits: '10.000000', capacityUnitId: 'unit-piece' }),
				binRow('unbounded', { code: 'A-02' }),
				binRow('elsewhere', {
					code: 'A-03',
					warehouseId: OTHER_WAREHOUSE,
					capacityUnits: '7.000000'
				})
			]
		});

		const warnings = await fixture.service.capacityWarnings();

		expect(warnings.map((warning) => warning.binId)).toEqual(['pallet-a', 'pallet-b', 'elsewhere', 'shelf-b']);
		expect(warnings[0]).toMatchObject({
			code: 'P-01',
			type: WarehouseBinType.PALLET,
			capacityUnits: '1.000000',
			notice: WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED
		});
	});

	it('narrows the warning list to one location when the caller names one', async () => {
		const fixture = binFixture({
			bins: [
				binRow('mine', { code: 'A-01', capacityUnits: '1.000000' }),
				binRow('elsewhere', { code: 'A-02', warehouseId: OTHER_WAREHOUSE, capacityUnits: '1.000000' })
			]
		});

		expect((await fixture.service.capacityWarnings(WAREHOUSE)).map((warning) => warning.binId)).toEqual(['mine']);
		expect((await fixture.service.capacityWarnings()).map((warning) => warning.binId)).toEqual([
			'mine',
			'elsewhere'
		]);
	});
});

describe('WarehouseBinService — reconciling placement against the ledger (doc 09 §14.10, INV-23, INV-27)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a reconciliation when no inventory capability is registered', async () => {
		// The level is the ledger's to decide, so a service that could not reach it has nothing to
		// compare against and says so rather than reporting a clean sheet.
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await expect(fixture.service.reconcile({ warehouseId: WAREHOUSE })).rejects.toThrow(
			/WAREHOUSE_STOCK_LEDGER_UNAVAILABLE/
		);
	});

	it('reports nothing, and moves nothing, when the bins, the unplaced units and the level row agree', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			ledger: {
				placement: { [VARIANT]: { 'bin-1': '10.000000' } },
				levels: { [VARIANT]: { binId: 'bin-1', quantity: '10.000000' } }
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report).toMatchObject({ warehouseId: WAREHOUSE, binIds: ['bin-1'], driftCount: 0, movementIds: [] });
		expect(report.lines).toEqual([]);
		expect(report.placedQuantity).toBe('10.000000');
		expect(report.unplacedQuantity).toBe('0.000000');
		expect(fixture.capability?.relocations).toEqual([]);
		expect(fixture.capability?.movements).toEqual([]);
	});

	it('corrects a drifted position with one relocation pair and leaves the level exactly as it was', async () => {
		// The units are inside the location and the totals agree; what disagrees is the declaration,
		// which says the variant is kept in bin-2 while the ledger has them in bin-1. The correction is
		// a relocation — equal and opposite, reservation-neutral, and the level is not touched (INV-27).
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('bin-2')],
			ledger: {
				placement: { [VARIANT]: { 'bin-1': '10.000000' } },
				levels: { [VARIANT]: { binId: 'bin-2', quantity: '10.000000', reservedQuantity: '4.000000' } }
			}
		});
		const before = fixture.capability?.level(VARIANT);

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report.driftCount).toBe(1);
		expect(report.lines).toHaveLength(1);
		expect(report.lines[0]).toMatchObject({
			binId: 'bin-2',
			variantId: VARIANT,
			expectedQuantity: '10.000000',
			countedQuantity: '10.000000',
			difference: '0.000000',
			placedQuantity: '10.000000',
			unplacedQuantity: '0.000000',
			homeBinId: 'bin-2',
			declaredQuantity: '0.000000',
			relocatedQuantity: '10.000000',
			repaired: true
		});
		expect(fixture.capability?.relocations).toEqual([
			{
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				fromBinId: 'bin-1',
				toBinId: 'bin-2',
				quantity: '10.000000',
				referenceType: 'RECONCILIATION',
				referenceId: 'bin-2',
				reason: 'RECONCILIATION'
			}
		]);
		expect(report.movementIds).toEqual(['relocation-1-out', 'relocation-1-in']);
		// Two rows, equal and opposite, reservation-neutral, one provenance.
		expect(fixture.capability?.legs.map((leg) => [leg.binId, leg.quantity])).toEqual([
			['bin-1', '-10.000000'],
			['bin-2', '10.000000']
		]);
		expect(fixture.capability?.legs.every((leg) => leg.reservedDelta === '0.000000')).toBe(true);
		expect(
			fixture.capability?.legs.every(
				(leg) => leg.referenceType === 'RECONCILIATION' && leg.referenceId === 'bin-2'
			)
		).toBe(true);
		// The level is the ledger sum for the location, and a relocation never changes it.
		expect(fixture.capability?.level(VARIANT)).toEqual(before);
		expect(fixture.capability?.level(VARIANT)).toMatchObject({
			binId: 'bin-2',
			quantity: '10.000000',
			reservedQuantity: '4.000000'
		});
		// Not one movement of any kind, and none of the kind the repair used to write.
		expect(fixture.capability?.movements).toEqual([]);
	});

	it('reports zero drift on a second run over the state it corrected', async () => {
		// The property the step exists for. A repair that changed the level could not do this: a
		// bin-tagged count moves the level and the bin by the same amount, so the difference it was
		// meant to close is the difference it leaves behind, and every run drives the level further
		// from the truth. A relocation moves the units and nothing else.
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('bin-2')],
			ledger: {
				placement: { [VARIANT]: { 'bin-1': '10.000000' } },
				levels: { [VARIANT]: { binId: 'bin-2', quantity: '10.000000' } }
			}
		});

		const first = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });
		const second = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(first.driftCount).toBe(1);
		expect(first.movementIds).toHaveLength(2);
		expect(second).toMatchObject({ driftCount: 0, movementIds: [] });
		expect(second.lines).toEqual([]);
		// Exactly one pair was written, by the first run.
		expect(fixture.capability?.relocations).toHaveLength(1);
		expect(fixture.capability?.movements).toEqual([]);
		expect(fixture.capability?.level(VARIANT)).toMatchObject({
			quantity: '10.000000',
			reservedQuantity: '0.000000'
		});
	});

	it('reports the unplaced units and leaves them where the ledger says they are', async () => {
		// `placed + unplaced = level.quantity` holds and the units are inside the location: this is a
		// report, not a drift, and the location has not asked for every unit to be addressed.
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			ledger: {
				placement: { [VARIANT]: { 'bin-1': '10.000000' } },
				unplaced: { [VARIANT]: '5.000000' },
				levels: { [VARIANT]: { binId: 'bin-1', quantity: '15.000000' } }
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report.driftCount).toBe(0);
		expect(report.lines).toHaveLength(1);
		expect(report.lines[0]).toMatchObject({
			binId: 'bin-1',
			variantId: VARIANT,
			expectedQuantity: '15.000000',
			countedQuantity: '15.000000',
			difference: '0.000000',
			placedQuantity: '10.000000',
			unplacedQuantity: '5.000000',
			repaired: false
		});
		expect(report.unplacedQuantity).toBe('5.000000');
		expect(fixture.capability?.relocations).toEqual([]);
		expect(fixture.capability?.movements).toEqual([]);
	});

	it('moves the unplaced units out of the bin the location names as its default when it requires full placement', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('receiving-bin', { zoneId: 'receiving-zone' })],
			zones: [zoneRow('zone-1'), zoneRow('receiving-zone', { type: WarehouseZoneType.RECEIVING })],
			warehouse: { metadata: { requireFullPlacement: true, defaultBinId: 'receiving-bin' } },
			ledger: {
				placement: { [VARIANT]: { 'bin-1': '10.000000' } },
				unplaced: { [VARIANT]: '5.000000' },
				levels: { [VARIANT]: { binId: 'bin-1', quantity: '15.000000' } }
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report.lines[0]).toMatchObject({
			unplacedQuantity: '5.000000',
			declaredQuantity: '10.000000',
			relocatedQuantity: '5.000000',
			repaired: true
		});
		// The surplus is unattributed — no bin holds units the level does not declare — so the units
		// come from the bin they physically sit in, which is the location's default bin.
		expect(fixture.capability?.relocations).toEqual([
			{
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				fromBinId: 'receiving-bin',
				toBinId: 'bin-1',
				quantity: '5.000000',
				referenceType: 'RECONCILIATION',
				referenceId: 'bin-1',
				reason: 'RECONCILIATION'
			}
		]);
		expect(fixture.capability?.level(VARIANT)).toMatchObject({ quantity: '15.000000' });

		// A fixpoint as well: the declared bin now holds what the level declares, so the next run
		// reports the unplaced units again and writes nothing more.
		const second = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(second.driftCount).toBe(0);
		expect(second.movementIds).toEqual([]);
		expect(second.unplacedQuantity).toBe('5.000000');
		expect(fixture.capability?.relocations).toHaveLength(1);
	});

	it('falls back to the first bin of the receiving area when the location names no default bin', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('receiving-bin', { zoneId: 'receiving-zone' })],
			zones: [zoneRow('zone-1'), zoneRow('receiving-zone', { type: WarehouseZoneType.RECEIVING })],
			warehouse: { metadata: { requireFullPlacement: true } },
			ledger: {
				placement: { [VARIANT]: { 'bin-1': '10.000000' } },
				unplaced: { [VARIANT]: '5.000000' },
				levels: { [VARIANT]: { binId: 'bin-1', quantity: '15.000000' } }
			}
		});

		await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(fixture.capability?.relocations[0]).toMatchObject({
			fromBinId: 'receiving-bin',
			toBinId: 'bin-1',
			quantity: '5.000000'
		});
	});

	it('moves what a bin can account for and reports the rest instead of inventing units', async () => {
		// The ledger holds four units in bin-1 and the level declares ten at bin-2. The four are a
		// surplus bin-1 holds, so the correction moves them; the other six exist nowhere the ledger can
		// point at, and the run reports them rather than writing a movement that would invent stock.
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('bin-2')],
			ledger: {
				placement: { [VARIANT]: { 'bin-1': '4.000000' } },
				levels: { [VARIANT]: { binId: 'bin-2', quantity: '10.000000' } }
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report.lines[0]).toMatchObject({
			expectedQuantity: '10.000000',
			countedQuantity: '4.000000',
			difference: '-6.000000',
			relocatedQuantity: '4.000000',
			repaired: true
		});
		expect(fixture.capability?.relocations[0]).toMatchObject({
			fromBinId: 'bin-1',
			toBinId: 'bin-2',
			quantity: '4.000000'
		});

		// The next run finds nothing left that a relocation could move, and still reports the six units
		// the level claims and the ledger does not hold.
		const second = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(second.driftCount).toBe(1);
		expect(second.lines[0]).toMatchObject({ difference: '-6.000000', repaired: false });
		expect(second.movementIds).toEqual([]);
		expect(fixture.capability?.relocations).toHaveLength(1);
		expect(fixture.capability?.movements).toEqual([]);
	});

	it('reports a location that declares no address at all and writes no movement for it', async () => {
		// No level row names a home bin and the location has no receiving area: there is no second bin
		// to move units between, so the finding is reported and nothing is invented to hold it.
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			ledger: { placement: { [VARIANT]: { 'bin-1': '10.000000' } } }
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report.driftCount).toBe(1);
		expect(report.lines[0]).toMatchObject({
			binId: 'bin-1',
			expectedQuantity: '0.000000',
			countedQuantity: '10.000000',
			difference: '10.000000',
			repaired: false
		});
		expect(report.lines[0].homeBinId).toBeUndefined();
		expect(fixture.capability?.relocations).toEqual([]);
		expect(fixture.capability?.movements).toEqual([]);
	});

	it('rewrites the balance snapshot a bin caches, and writes no ledger row', async () => {
		const fixture = binFixture({
			bins: [
				binRow('bin-1', {
					metadata: {
						note: 'keep me',
						balances: { [VARIANT]: '3.000000' },
						balanceUpdatedAt: '2020-01-01T00:00:00.000Z'
					}
				})
			],
			ledger: {
				placement: { [VARIANT]: { 'bin-1': '10.000000' } },
				levels: { [VARIANT]: { binId: 'bin-1', quantity: '10.000000' } }
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report.lines).toEqual([]);
		expect(fixture.store('bin-1').metadata).toMatchObject({
			note: 'keep me',
			balances: { [VARIANT]: '10.000000' }
		});
		expect(fixture.store('bin-1').metadata.balanceUpdatedAt).not.toBe('2020-01-01T00:00:00.000Z');
		// A snapshot is a cache: refreshing it is not a movement, and nothing reaches the ledger.
		expect(fixture.capability?.movements).toEqual([]);
		expect(fixture.capability?.relocations).toEqual([]);

		// A second run finds the cache already stating the derived figures and rewrites nothing.
		const writes = fixture.binWrites.length;

		await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(fixture.binWrites).toHaveLength(writes);
	});

	it('reports a declaration outside the bins of a narrowed run and moves nothing for it', async () => {
		// A run the caller narrowed to one area may not reach into another: the partition it was asked
		// about is the one it corrects, and a count of one aisle must not rearrange the building.
		const fixture = binFixture({
			bins: [binRow('bin-1', { zoneId: 'zone-1' }), binRow('bin-2', { zoneId: 'zone-2' })],
			zones: [zoneRow('zone-1'), zoneRow('zone-2')],
			ledger: {
				placement: { [VARIANT]: { 'bin-1': '10.000000' } },
				levels: { [VARIANT]: { binId: 'bin-2', quantity: '10.000000' } }
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, zoneId: 'zone-1', repair: true });

		expect(report.binIds).toEqual(['bin-1']);
		expect(report.driftCount).toBe(1);
		expect(report.lines[0]).toMatchObject({
			binId: 'bin-2',
			homeBinId: 'bin-2',
			declaredQuantity: '0.000000',
			repaired: false
		});
		expect(fixture.capability?.relocations).toEqual([]);
		expect(fixture.capability?.movements).toEqual([]);
	});

	it('counts exactly the positions of the location, or exactly the ones the caller names', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('bin-2'), binRow('elsewhere', { warehouseId: OTHER_WAREHOUSE })],
			ledger: {}
		});

		const whole = await fixture.service.reconcile({ warehouseId: WAREHOUSE });
		const named = await fixture.service.reconcile({ warehouseId: WAREHOUSE, binIds: ['bin-2'] });

		expect(whole.binIds).toEqual(['bin-1', 'bin-2']);
		expect(named.binIds).toEqual(['bin-2']);
	});

	it('asks the ledger only for the positions in scope, so a count cannot read the whole building', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('bin-2')],
			ledger: {}
		});

		await fixture.service.reconcile({ warehouseId: WAREHOUSE, binIds: ['bin-1'] });

		expect(fixture.capability?.asked).toEqual([{ warehouseId: WAREHOUSE, binIds: ['bin-1'] }]);
	});
});
