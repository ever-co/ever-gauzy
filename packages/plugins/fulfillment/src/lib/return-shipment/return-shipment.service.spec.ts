/**
 * Two module boundaries are doubled here, and the reason is the same for both.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which raising a shipment needs and none of which is
 * available outside a running application. `@gauzy/plugin-order`'s barrel re-exports the whole order
 * and cart domain, which a shipment with no lines never reads. Both seams are therefore doubled at
 * the module boundary and **the services under test are the real ones**: the capability that raises
 * the leg, the real shipment service it composes — so the leg's direction, status and scope are the
 * domain's own — and the real shipping-option service that supplies what the journey is configured
 * with.
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

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({
				...options,
				where: { ...(options.where ?? {}), id }
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		/**
		 * The fail-soft half of the pair, which is the read the option lookup uses: an option that is not
		 * the caller's is an ordinary answer there, not an exception to be caught.
		 */
		async findOneOrFailByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			return record ? { success: true, record } : { success: false };
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			}

			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
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
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		BaseEvent: class {},
		EventBus: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			// The scope the fixture's rows are stamped with. A case about tenancy re-points it with a spy,
			// so the scope is never a constant of this specification.
			currentTenantId: () => '00000000-0000-4000-8000-000000000001',
			currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('@gauzy/plugin-order', () => ({
	// The order line's counters are what an outbound shipment moves, and a return leg moves none: the
	// class here is only the module's identity.
	OrderLineService: class OrderLineService {}
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FulfillmentDirection, FulfillmentStatusDetail } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { FulfillmentLineService } from '../fulfillment-line/fulfillment-line.service';
import { FulfillmentService } from '../fulfillment/fulfillment.service';
import { ShippingOptionService } from '../shipping-option/shipping-option.service';
import { ReturnShipmentService } from './return-shipment.service';

/**
 * The leg a return travels on, as the flow that decided on the return raises it.
 *
 * What this suite is about is what the raise *writes*, because a shipment is a commitment: a parcel
 * the carrier is asked to collect, and an order-line counter nobody may move twice.
 *
 * - **The leg is a shipment and nothing else.** It is raised as a fulfilment whose direction is
 *   `RETURN`, `PENDING`, at version one, and it carries **no lines**: goods coming back are not
 *   fetched from a bin, so there is nothing to pick and nothing to count. What it does carry is the
 *   reference to the return that authorised it, kept in the shipment's own payload, because a leg
 *   nobody can trace back to a return is a parcel nobody can explain.
 * - **The configured option supplies the journey.** The registered strategy that will carry the
 *   parcel and the service level the tenant sells it as are read from the chosen option inside the
 *   caller's scope; an option that is not the caller's is refused rather than ignored, since a leg
 *   raised without them travels a way the tenant did not configure.
 * - **The label is reported when there is one.** No carrier integration is installed, so the answer
 *   reports no label rather than a fabricated reference to a document that does not exist.
 * - **The scope is the caller's**, stamped from the request context rather than taken from the
 *   caller, so a leg is always written where the caller's own reads will find it.
 *
 * The capability is constructed over in-memory doubles of the tables' repositories, and the doubles
 * answer the statements the services actually issue: the `where` narrowing and the two read forms —
 * the raising read and the kernel's fail-soft pair the option lookup uses.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000004';

const ORDER = '00000000-0000-4000-8000-000000000010';
const RETURN = '00000000-0000-4000-8000-000000000020';
const WAREHOUSE = '00000000-0000-4000-8000-0000000000a0';
const OPTION = '00000000-0000-4000-8000-0000000000b0';

type Row = Record<string, any>;

/**
 * @param row A stored row.
 * @param where The condition the service stated.
 * @returns Whether the database would have returned the row. An `undefined` member is not a condition
 * at all — TypeORM drops it — which is why it matches.
 */
function matches(row: Row, where: Row = {}): boolean {
	return Object.entries(where ?? {}).every(
		([field, value]) => value === undefined || String(row[field] ?? '') === String(value ?? '')
	);
}

/**
 * @param rows The rows of one table.
 * @returns A repository double that narrows by the stated `where`, writes into the same rows, and
 * records nothing: every assertion below is about state.
 */
function repository(rows: Row[]) {
	return {
		rows,
		find: async (options: Row = {}) => rows.filter((row) => matches(row, options.where)),
		findOne: async (options: Row = {}) => rows.filter((row) => matches(row, options.where))[0] ?? null,
		findOneBy: async (where: Row = {}) => rows.find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: Row = {}) => {
			const items = rows.filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => {
			const created = { id: `fulfillment-${rows.length + 1}`, ...row };

			rows.push(created);

			return created;
		},
		update: async (criteria: any, partial: Row) => {
			const index =
				typeof criteria === 'string'
					? rows.findIndex((row) => row.id === criteria)
					: rows.findIndex((row) => matches(row, criteria));

			if (index >= 0) {
				Object.assign(rows[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async () => ({ affected: 0 })
	};
}

/** One `shipping_option` row, as the raise reads it. */
const optionRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: 'Express delivery',
	code: 'express-24h',
	priceType: 'FLAT',
	providerKey: 'carrier-strategy',
	...overrides
});

/**
 * @param options The rows the fixture starts with.
 * @returns The capability, wired to the real services over the doubles, and the tables themselves.
 */
function fixture(options: { shipments?: Row[]; shippingOptions?: Row[] } = {}) {
	const shipments = options.shipments ?? [];
	const shippingOptions = options.shippingOptions ?? [optionRow(OPTION)];
	const shipmentRepository = repository(shipments);
	const optionRepository = repository(shippingOptions);
	const lineRepository = repository([]);
	const lineService = new FulfillmentLineService(lineRepository as never, {} as never);
	const fulfillmentService = new FulfillmentService(
		shipmentRepository as never,
		{} as never,
		lineService,
		{} as never
	);
	const shippingOptionService = new ShippingOptionService(optionRepository as never, {} as never);
	const service = new ReturnShipmentService(fulfillmentService, shippingOptionService);

	return { service, fulfillmentService, shipments, shippingOptions, lines: lineRepository.rows };
}

describe('ReturnShipmentService — the leg a return travels on', () => {
	afterEach(() => jest.restoreAllMocks());

	it('raises a return shipment, pending, for the return that authorised it', async () => {
		const { service, shipments, lines } = fixture({});

		const leg = await service.createReturnShipment({
			returnId: RETURN,
			orderId: ORDER,
			warehouseId: WAREHOUSE,
			trackingNumber: 'TRACK-1'
		});

		expect(leg).toEqual({ fulfillmentId: 'fulfillment-1', trackingNumber: 'TRACK-1' });
		expect(shipments[0]).toMatchObject({
			id: 'fulfillment-1',
			orderId: ORDER,
			warehouseId: WAREHOUSE,
			trackingNumber: 'TRACK-1',
			direction: FulfillmentDirection.RETURN,
			status: FulfillmentStatusDetail.PENDING,
			requiresShipping: true,
			version: 1,
			tenantId: TENANT,
			organizationId: ORG,
			metadata: { returnId: RETURN }
		});
		// The leg carries no lines: nothing is picked for goods that come back, and the order line's
		// counters are the ones a shipment of goods *out* moves.
		expect(lines).toEqual([]);
	});

	it('records what the chosen option configures: the strategy and the service level', async () => {
		const { service, shipments } = fixture({
			shippingOptions: [optionRow(OPTION, { providerKey: 'carrier-strategy', code: 'express-24h' })]
		});

		await service.createReturnShipment({ returnId: RETURN, orderId: ORDER, shippingOptionId: OPTION });

		expect(shipments[0]).toMatchObject({ providerId: 'carrier-strategy', service: 'express-24h' });
	});

	it('reports no label, because no carrier integration issued one', async () => {
		const { service, shipments } = fixture({});

		const leg = await service.createReturnShipment({ returnId: RETURN, orderId: ORDER });

		expect('labelUrl' in leg).toBe(false);
		expect('trackingNumber' in leg).toBe(false);
		// Nothing fabricated on the row either: the label is whatever a carrier later returns.
		expect(shipments[0].labelUrl).toBeUndefined();
	});

	it('refuses an option that is not the caller and raises no leg', async () => {
		const { service, shipments } = fixture({
			shippingOptions: [optionRow(OPTION, { organizationId: OTHER_ORG })]
		});

		await expect(
			service.createReturnShipment({ returnId: RETURN, orderId: ORDER, shippingOptionId: OPTION })
		).rejects.toBeInstanceOf(NotFoundException);
		expect(shipments).toEqual([]);
	});

	it('refuses a request that names no return or no order, and raises no leg', async () => {
		const { service, shipments } = fixture({});

		await expect(service.createReturnShipment({ orderId: ORDER } as never)).rejects.toThrow(
			/RETURN_LEG_RETURN_REQUIRED/
		);
		await expect(service.createReturnShipment({ returnId: RETURN } as never)).rejects.toThrow(
			/RETURN_LEG_ORDER_REQUIRED/
		);
		expect(shipments).toEqual([]);
	});

	it('is refused by the shipment domain as well when no order is named', async () => {
		// The guard the capability never reaches, because it refuses first: a leg is a shipment against
		// an order, and the domain that owns shipments is the one that says so.
		const { fulfillmentService, shipments } = fixture({});

		await expect(fulfillmentService.createReturnLeg({} as never)).rejects.toBeInstanceOf(BadRequestException);
		expect(shipments).toEqual([]);
	});

	it('writes the leg inside the caller\'s own tenant and organization', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-2');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, shipments } = fixture({
			shippingOptions: [optionRow(OPTION, { tenantId: 'tenant-2', organizationId: OTHER_ORG })]
		});

		await service.createReturnShipment({ returnId: RETURN, orderId: ORDER, shippingOptionId: OPTION });

		// The scope is stamped from the request context rather than taken from the caller: a leg is written
		// where the caller's own reads will find it.
		expect(shipments[0]).toMatchObject({ tenantId: 'tenant-2', organizationId: OTHER_ORG });
	});

	it('leaves an option of another tenant to be found by nobody', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-2');
		const { service, shipments } = fixture({ shippingOptions: [optionRow(OPTION)] });

		await expect(
			service.createReturnShipment({ returnId: RETURN, orderId: ORDER, shippingOptionId: OPTION })
		).rejects.toBeInstanceOf(NotFoundException);
		expect(shipments).toEqual([]);
	});

	it('raises the leg without an option when the tenant configured none', async () => {
		const { service, shipments } = fixture({});

		const leg = await service.createReturnShipment({ returnId: RETURN, orderId: ORDER });

		expect(leg.fulfillmentId).toBe('fulfillment-1');
		expect(shipments[0].providerId).toBeUndefined();
		expect(shipments[0].service).toBeUndefined();
	});
});
