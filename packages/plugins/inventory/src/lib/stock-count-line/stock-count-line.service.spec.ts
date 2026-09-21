/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a variance report needs and none of which is
 * available outside a running application, and its nested `uuid` is ESM-only under jest. The barrel
 * is therefore doubled at the module boundary, as every other service suite in this package does,
 * and **the service under test is the real one**.
 *
 * The exact decimal primitives are taken **real** rather than doubled. What this suite is about is
 * that a valuation is arithmetic on the digits of two `numeric(20,6)` columns rather than on binary
 * floating point, so doubling that arithmetic would be doubling the thing under test.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findOneByIdString(id: any): Promise<any> {
			const record = await this.typeOrmRepository.findOne({ where: { id } });

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}
	}

	const decimal = jest.requireActual('@gauzy/core/src/lib/money/decimal');

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
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		ProductVariantPrice: class ProductVariantPrice {},
		Warehouse: class Warehouse {},
		WarehouseProduct: class WarehouseProduct {},
		WarehouseProductVariant: class WarehouseProductVariant {},
		User: class User {},
		addDecimalStrings: decimal.addDecimalStrings,
		subtractDecimalStrings: decimal.subtractDecimalStrings,
		compareDecimalStrings: decimal.compareDecimalStrings,
		parseDecimalString: decimal.parseDecimalString,
		formatDecimalUnits: decimal.formatDecimalUnits,
		multiplyDecimalUnits: decimal.multiplyDecimalUnits,
		pow10: decimal.pow10,
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

import { FindOperator } from 'typeorm';
import { ProductVariantPrice, RequestContext } from '@gauzy/core';
import { StockCountLineService } from './stock-count-line.service';

/**
 * The variance report of a count session.
 *
 * Two properties are worth a suite of their own, and both are about the arithmetic rather than about
 * the read:
 *
 * - **the valuation is exact.** A variance is a `numeric(20,6)` quantity and a unit cost is a
 *   `numeric(20,6)` amount; multiplying and accumulating them as doubles turns `0.1 × 0.1` into
 *   `0.010000000000000002` and three of them into `0.030000000000000006`, which is the figure a
 *   location would then sign a write-off against;
 * - **a missing cost is reported, never invented.** A line whose variant has no recorded cost counts
 *   towards the units and towards `unpricedLines`, and contributes nothing to the value.
 *
 * The price rows are read through the entity, tenant-scoped, in one query for the whole session —
 * the read that replaced a hand-written statement selecting a column `product_variant_price` does
 * not have — so the double answers the same relation condition the service states.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000002';
const SESSION = '00000000-0000-4000-8000-000000000010';
const VARIANT = '00000000-0000-4000-8000-000000000020';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000021';

type Row = Record<string, any>;

/** Whether two identifiers name the same row, whatever type each arrived as. */
const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');

/**
 * An in-memory stand-in for the two reads the report makes: the session's lines, and the price rows
 * of the variants they name.
 *
 * The price read states its variant as a **relation** condition — `{ productVariant: { id: In(…) } }`
 * — because the join column is named `productVariantId` and asking through the relation is what makes
 * the ORM write the column's real name for whichever dialect is configured. The double therefore
 * answers that shape rather than a flat column condition, so a suite passing here is a suite whose
 * service states the read the way the entity actually maps it.
 *
 * @param lines The count lines the session holds.
 * @param prices The price rows the catalogue holds.
 */
function fixture(lines: Row[], prices: Row[] = []) {
	const reads: Row[] = [];
	const matchesVariant = (row: Row, condition: any): boolean => {
		const stated = condition?.productVariant?.id;

		if (stated === undefined) {
			return true;
		}

		if (stated instanceof FindOperator) {
			if (stated.type !== 'in') {
				throw new Error(`the in-memory double does not implement the "${stated.type}" operator`);
			}

			return (stated.value as unknown[]).some((candidate) => same(row.productVariant?.id, candidate));
		}

		return same(row.productVariant?.id, stated);
	};
	const repository: any = {
		find: async (options: any = {}) => {
			reads.push(options?.where ?? {});

			return lines.filter((line) => {
				const where = options?.where ?? {};

				if (where.stockCountId !== undefined && !same(line.stockCountId, where.stockCountId)) {
					return false;
				}

				return where.tenantId === undefined || same(line.tenantId, where.tenantId);
			});
		},
		findAndCount: async () => [lines, lines.length],
		manager: {
			find: async (entity: unknown, options: any = {}) => {
				if (entity !== ProductVariantPrice) {
					throw new Error('the in-memory double was handed an entity it does not know');
				}

				reads.push(options?.where ?? {});

				return prices.filter((price) => {
					const where = options?.where ?? {};

					if (!matchesVariant(price, where)) {
						return false;
					}

					return where.tenantId === undefined || same(price.tenantId, where.tenantId);
				});
			}
		}
	};

	return { service: new StockCountLineService(repository as never, {} as never), reads };
}

/** One `stock_count_line` row, as the report reads it. */
const line = (variantId: string, variance: unknown, overrides: Row = {}): Row => ({
	id: `line-${variantId}-${String(variance)}`,
	stockCountId: SESSION,
	tenantId: TENANT,
	variantId,
	variance,
	...overrides
});

/** One `product_variant_price` row, addressed through the relation the service reads it by. */
const price = (variantId: string, unitCost: unknown, tenantId: string = TENANT): Row => ({
	id: `price-${variantId}`,
	tenantId,
	unitCost,
	productVariant: { id: variantId }
});

describe('StockCountLineService — the variance report of a session (doc 09 §10)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => jest.restoreAllMocks());

	it('values a sheet whose decimals do not divide evenly over the exact digits of both columns', async () => {
		// Three lines, each a tenth out, each valued at a tenth. As doubles the product of one line is
		// `0.010000000000000002` and the three of them sum to `0.030000000000000006`; the units sum to
		// `0.30000000000000004`. Both are the figures an operator would read off a variance report and
		// a location would sign a stock write-off against.
		const { service } = fixture(
			[line(VARIANT, 0.1), line(VARIANT, -0.1), line(OTHER_VARIANT, 0.1)],
			[price(VARIANT, 0.1), price(OTHER_VARIANT, 0.1)]
		);

		const report = await service.varianceOf(SESSION);

		expect(report).toEqual({ units: 0.3, value: 0.03, unpricedLines: 0 });
	});

	it('counts the magnitude of a variance, whichever direction it went', async () => {
		// A count reports how far the record was out, not which way: two lines a unit apart in opposite
		// directions are two units of variance and are valued as two.
		const { service } = fixture([line(VARIANT, 2), line(VARIANT, -3)], [price(VARIANT, '1.5')]);

		const report = await service.varianceOf(SESSION);

		expect(report).toEqual({ units: 5, value: 7.5, unpricedLines: 0 });
	});

	it('reports a line it cannot value rather than inventing a cost for it', async () => {
		// A valuation built on an invented cost is worse than a valuation that says it is incomplete, so
		// the unpriced line still counts towards the units and is named in its own figure.
		const { service } = fixture(
			[line(VARIANT, '1.250000'), line(OTHER_VARIANT, '2.000000')],
			[price(VARIANT, '4.000000')]
		);

		const report = await service.varianceOf(SESSION);

		expect(report).toEqual({ units: 3.25, value: 5, unpricedLines: 1 });
	});

	it('leaves a line with no variance out of both totals', async () => {
		const { service } = fixture(
			[line(VARIANT, 0), line(VARIANT, null), line(OTHER_VARIANT, '0.000000')],
			[price(VARIANT, '9.99')]
		);

		const report = await service.varianceOf(SESSION);

		expect(report).toEqual({ units: 0, value: 0, unpricedLines: 0 });
	});

	it('reads the lines and the prices of the caller’s own tenant, in one query for the session', async () => {
		// One read for the whole session rather than one per line, and both reads narrowed to the tenant:
		// a valuation must not be able to price a variance with a cost another tenant recorded.
		const { service, reads } = fixture(
			[line(VARIANT, 1), line(VARIANT, 1, { id: 'theirs', tenantId: OTHER_TENANT })],
			[price(VARIANT, '2.000000', OTHER_TENANT)]
		);

		const report = await service.varianceOf(SESSION);

		expect(report).toEqual({ units: 1, value: 0, unpricedLines: 1 });
		expect(reads).toHaveLength(2);
		expect(reads[0]).toMatchObject({ stockCountId: SESSION, tenantId: TENANT });
		expect(reads[1]).toMatchObject({ tenantId: TENANT });
	});

	it('asks for no prices at all when the session has no lines to value', async () => {
		const { service, reads } = fixture([]);

		const report = await service.varianceOf(SESSION);

		expect(report).toEqual({ units: 0, value: 0, unpricedLines: 0 });
		expect(reads).toHaveLength(1);
	});
});
