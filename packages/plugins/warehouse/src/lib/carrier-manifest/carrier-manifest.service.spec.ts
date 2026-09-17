/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a manifest service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * as the catalogue and inventory packages' service specs do, and **the service under test is the
 * real one**: only the base CRUD class, the request context and the entity base classes are
 * substituted.
 *
 * The base-class double mirrors `TenantAwareCrudService` where the behaviour is observable to a
 * caller: `create` answers with the saved row, `update` reaches the repository and answers with
 * TypeORM's `UpdateResult`, and a write against an id that is not there is a miss rather than a
 * silent no-op.
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
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { CarrierManifestStatus, IWarehouseFulfillmentPort, MANIFEST_NUMBER_KEY } from '../warehouse.types';
import { CarrierManifestService } from './carrier-manifest.service';

/**
 * The custody boundary: the parcels handed to a carrier at one dock, at one time, with one scan.
 *
 * Membership is **derived while a draft and frozen at close** (doc 09 §14.7, INV-24). Closing writes
 * the manifest id onto each of its shipments in one transaction, which is what stops a parcel
 * appearing on two manifests and what makes the manifest reproducible after the fact. The suite
 * pins the four refusals the machine states — an empty manifest is not a hand-over, a member without
 * a tracking number is a parcel the carrier cannot be asked about, a handed-over manifest is a
 * carrier dispute rather than a data change, and nothing may be appended to a manifest the carrier
 * already accepted — and it pins the totals the close freezes, because those are the numbers a
 * carrier invoice is checked against.
 *
 * The service is constructed directly over an in-memory manifest table and a hand-written shipment
 * capability that keeps what it was asked and what it was told to claim, so "membership was frozen"
 * is asserted against the link that freezes it rather than against the status column alone.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const DOCK_OPERATOR = '00000000-0000-4000-8000-000000000050';
const CARRIER = 'acme';
const SERVICE = 'express';

/** The manifest table, as plain rows. */
interface ITables {
	manifest: any[];
}

/**
 * An in-memory stand-in for the manifest table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository reads and writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: any, where: any = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			if (expected && typeof expected === 'object' && 'type' in (expected as any)) {
				throw new Error(`the in-memory double does not implement the "${(expected as any).type}" operator`);
			}

			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => rows().filter((row) => matches(row, options.where)),
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
		update: async (criteria: any, partial: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

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
		}
	};
}

/** The platform numbering series, as a hand-written double. */
function numbering(prefixes: string[] = [MANIFEST_NUMBER_KEY]) {
	let sequence = 0;

	return {
		service: {
			async allocate(key: string) {
				if (!prefixes.includes(key)) {
					throw new Error(`no series is configured for "${key}"`);
				}

				return { formatted: `${key}-${String(++sequence).padStart(6, '0')}` };
			}
		}
	};
}

/**
 * A hand-written stand-in for the shipment capability.
 *
 * It is the pool a manifest derives from: a shipment is in the pool while nothing has claimed it,
 * and claiming it is what freezes the manifest's membership. Every question the service asks and
 * every claim or release it makes is kept, so the freeze is asserted against the link rather than
 * against a status.
 *
 * @param shipments The shipments the location has shipped.
 */
function shipmentCapability(shipments: any[]) {
	const asks: any[] = [];
	const claims: any[] = [];
	const releases: any[] = [];
	const port: IWarehouseFulfillmentPort = {
		listShippableLines: async () => [],
		listShipped: async (query) => {
			asks.push(query);

			return shipments.filter((shipment) => {
				if (query.carrier && shipment.carrier !== query.carrier) {
					return false;
				}
				if (query.service && shipment.service !== query.service) {
					return false;
				}
				if (query.unclaimedOnly && shipment.claimedBy) {
					return false;
				}

				return true;
			});
		},
		claimForManifest: async ({ manifestId, fulfillmentIds }) => {
			claims.push({ manifestId, fulfillmentIds });

			for (const shipment of shipments) {
				if (fulfillmentIds.map(String).includes(String(shipment.fulfillmentId))) {
					shipment.claimedBy = manifestId;
				}
			}

			return fulfillmentIds.length;
		},
		releaseFromManifest: async ({ manifestId, fulfillmentIds }) => {
			releases.push({ manifestId, fulfillmentIds });

			for (const shipment of shipments) {
				if (fulfillmentIds.map(String).includes(String(shipment.fulfillmentId))) {
					shipment.claimedBy = null;
				}
			}

			return fulfillmentIds.length;
		}
	};

	return { port, asks, claims, releases, shipments };
}

/** One shipment, as the shipment capability reports it. */
const shipped = (id: string, overrides: Record<string, unknown> = {}) => ({
	fulfillmentId: id,
	warehouseId: WAREHOUSE,
	orderId: `order-${id}`,
	carrier: CARRIER,
	service: SERVICE,
	shippedAt: new Date('2026-02-01T10:00:00.000Z'),
	trackingNumber: `TRACK-${id}`,
	packageCount: 1,
	packedWeight: '0',
	...overrides
});

/** One `carrier_manifest` row, as the service reads it. */
const manifestRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	carrier: CARRIER,
	service: SERVICE,
	number: `MANIFEST-${id}`,
	status: CarrierManifestStatus.DRAFT,
	manifestDate: new Date('2026-02-01T00:00:00.000Z'),
	shipmentCount: 0,
	packageCount: 0,
	totalWeight: '0.0000',
	version: 1,
	...overrides
});

/**
 * Builds the manifest service over an in-memory manifest table.
 *
 * @param options.manifests The manifests the fixture starts with.
 * @param options.shipments The shipments the location has shipped.
 * @param options.withFulfillment Whether the shipment capability is registered at all.
 * @param options.series The numbering series the organization has configured.
 */
function manifestFixture(
	options: { manifests?: any[]; shipments?: any[]; withFulfillment?: boolean; series?: string[] } = {}
) {
	const tables: ITables = { manifest: [...(options.manifests ?? [])] };
	const capability = shipmentCapability(options.shipments ?? []);
	const series = numbering(options.series);
	const service = new CarrierManifestService(
		repository(tables, 'manifest') as never,
		{} as never,
		series.service as never,
		(options.withFulfillment ?? true) ? capability.port : undefined
	);

	return {
		service,
		tables,
		capability,
		store: (id: string) => tables.manifest.find((row) => row.id === id)
	};
}

describe('CarrierManifestService — creating a draft manifest (doc 09 §14.7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(DOCK_OPERATOR);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a draft for a carrier and a day, with empty totals and the allocated number', async () => {
		const fixture = manifestFixture();

		const created = await fixture.service.create({ warehouseId: WAREHOUSE, carrier: CARRIER } as never);

		expect(created).toMatchObject({
			warehouseId: WAREHOUSE,
			carrier: CARRIER,
			number: 'MANIFEST-000001',
			status: CarrierManifestStatus.DRAFT,
			shipmentCount: 0,
			packageCount: 0,
			totalWeight: '0.0000',
			version: 1,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(created.manifestDate).toBeInstanceOf(Date);
	});

	it('keeps the day, the service and the window the caller states', async () => {
		// The window is what a draft collects from, so a manifest for one collection is one window.
		const fixture = manifestFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			carrier: CARRIER,
			service: SERVICE,
			manifestDate: new Date('2026-02-02T00:00:00.000Z'),
			windowFrom: new Date('2026-02-01T08:00:00.000Z'),
			windowTo: new Date('2026-02-01T12:00:00.000Z')
		} as never);

		expect(created).toMatchObject({
			service: SERVICE,
			manifestDate: new Date('2026-02-02T00:00:00.000Z'),
			windowFrom: new Date('2026-02-01T08:00:00.000Z'),
			windowTo: new Date('2026-02-01T12:00:00.000Z')
		});
	});

	it('refuses a manifest that names no location and one that names no carrier', async () => {
		const fixture = manifestFixture();

		await expect(fixture.service.create({ carrier: CARRIER } as never)).rejects.toThrow(
			/must name the location the parcels leave from/
		);
		await expect(fixture.service.create({ warehouseId: WAREHOUSE } as never)).rejects.toThrow(
			/must name the carrier it is handed to/
		);
		expect(fixture.tables.manifest).toEqual([]);
	});

	it('refuses a manifest when the organization has no numbering series, and writes nothing', async () => {
		const fixture = manifestFixture({ series: [] });

		await expect(fixture.service.create({ warehouseId: WAREHOUSE, carrier: CARRIER } as never)).rejects.toThrow(
			/No numbering series is configured for manifests/
		);
		expect(fixture.tables.manifest).toEqual([]);
	});
});

describe('CarrierManifestService — resolving membership (doc 09 §14.7, INV-24)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(DOCK_OPERATOR);
	});

	afterEach(() => jest.restoreAllMocks());

	it('asks for the shipments at the location that match the carrier, the service and the window, unclaimed only', async () => {
		// While the manifest is a draft its membership is derived, so it must collect only the parcels
		// nothing has claimed yet — anything else would put one parcel on two manifests.
		const fixture = manifestFixture({
			manifests: [
				manifestRow('manifest-1', {
					windowFrom: new Date('2026-02-01T08:00:00.000Z'),
					windowTo: new Date('2026-02-01T12:00:00.000Z')
				})
			],
			shipments: [shipped('a'), shipped('b', { carrier: 'other' }), shipped('c', { service: 'saver' })]
		});

		const resolved = await fixture.service.resolveMembers('manifest-1');

		expect(resolved.members.map((member) => member.fulfillmentId)).toEqual(['a']);
		expect(fixture.capability.asks).toEqual([
			{
				warehouseId: WAREHOUSE,
				carrier: CARRIER,
				service: SERVICE,
				windowFrom: new Date('2026-02-01T08:00:00.000Z'),
				windowTo: new Date('2026-02-01T12:00:00.000Z'),
				unclaimedOnly: true
			}
		]);
	});

	it('leaves out a shipment another manifest has already claimed', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1')],
			shipments: [shipped('a'), shipped('b', { claimedBy: 'manifest-9' })]
		});

		expect((await fixture.service.resolveMembers('manifest-1')).members.map((m) => m.fulfillmentId)).toEqual(['a']);
	});

	it('answers with no member at all when the shipment capability is not registered', async () => {
		// A tenant that ships without manifests can still keep the record; what it cannot do is resolve a
		// membership, and an empty membership is what the close refusal reads.
		const fixture = manifestFixture({ manifests: [manifestRow('manifest-1')], withFulfillment: false });

		expect((await fixture.service.resolveMembers('manifest-1')).members).toEqual([]);
	});
});

describe('CarrierManifestService — closing a manifest (doc 09 §14.7, INV-24)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(DOCK_OPERATOR);
	});

	afterEach(() => jest.restoreAllMocks());

	it('freezes membership on every member and records the totals in the same call', async () => {
		// Closing writes the manifest id onto each member, which is what stops a parcel appearing on two
		// manifests and what makes the manifest reproducible after the fact.
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1')],
			shipments: [
				shipped('a', { packageCount: 3, packedWeight: '1.5' }),
				shipped('b', { packageCount: 2, packedWeight: '2.25' })
			]
		});

		const closed = await fixture.service.close('manifest-1');

		expect(fixture.capability.claims).toEqual([
			{ manifestId: 'manifest-1', fulfillmentIds: ['a', 'b'] }
		]);
		expect(closed).toMatchObject({
			status: CarrierManifestStatus.CLOSED,
			shipmentCount: 2,
			packageCount: 5,
			totalWeight: '3.750000',
			version: 2
		});
		expect(closed.closedAt).toBeInstanceOf(Date);
		expect(fixture.capability.shipments.map((shipment) => shipment.claimedBy)).toEqual([
			'manifest-1',
			'manifest-1'
		]);
	});

	it('counts one package for a shipment that does not report how many it is packed into', async () => {
		// Boundary: the parcel exists even when the shipment side was never told how it was packed, and a
		// count of zero would make the manifest claim a hand-over of nothing.
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1')],
			shipments: [shipped('a', { packageCount: undefined }), shipped('b', { packageCount: 0 })]
		});

		const closed = await fixture.service.close('manifest-1');

		expect(closed.packageCount).toBe(1);
	});

	it('sums the packed weights exactly, at the storage scale', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1')],
			shipments: [
				shipped('a', { packedWeight: '0.1' }),
				shipped('b', { packedWeight: '0.2' })
			]
		});

		const closed = await fixture.service.close('manifest-1');

		expect(closed.totalWeight).toBe('0.300000');
		expect(0.1 + 0.2).not.toBe(0.3);
	});

	it('counts nothing and claims nothing for a manifest that covers no shipment', async () => {
		// An empty manifest is not a hand-over: there is nothing to hand over and nothing to freeze.
		const fixture = manifestFixture({ manifests: [manifestRow('manifest-1')], shipments: [] });

		await expect(fixture.service.close('manifest-1')).rejects.toThrow(/MANIFEST_EMPTY/);
		expect(fixture.capability.claims).toEqual([]);
		expect(fixture.store('manifest-1')).toMatchObject({ status: CarrierManifestStatus.DRAFT, version: 1 });
	});

	it('refuses to close a manifest with a member that carries no tracking number', async () => {
		// A member without a tracking number is a parcel the carrier cannot be asked about.
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1')],
			shipments: [shipped('a'), shipped('b', { trackingNumber: undefined })]
		});

		await expect(fixture.service.close('manifest-1')).rejects.toThrow(
			/MANIFEST_FULFILLMENT_NOT_SHIPPED: 1 member shipment/
		);
		expect(fixture.capability.claims).toEqual([]);
		expect(fixture.store('manifest-1')).toMatchObject({ status: CarrierManifestStatus.DRAFT });
		// Nothing was frozen, so no shipment carries a manifest id.
		expect(fixture.capability.shipments.every((shipment) => !shipment.claimedBy)).toBe(true);
	});

	it('refuses to close a manifest that is not a draft', async () => {
		for (const status of [
			CarrierManifestStatus.CLOSED,
			CarrierManifestStatus.HANDED_OVER,
			CarrierManifestStatus.CANCELED
		]) {
			const fixture = manifestFixture({
				manifests: [manifestRow('manifest-1', { status })],
				shipments: [shipped('a')]
			});

			await expect(fixture.service.close('manifest-1')).rejects.toThrow(/MANIFEST_ILLEGAL_TRANSITION/);
			expect(fixture.capability.claims).toEqual([]);
		}
	});

	it('is not idempotent: the second close is refused rather than re-freezing the membership', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1')],
			shipments: [shipped('a')]
		});

		await fixture.service.close('manifest-1');

		await expect(fixture.service.close('manifest-1')).rejects.toThrow(/MANIFEST_ILLEGAL_TRANSITION/);
		expect(fixture.capability.claims).toHaveLength(1);
		expect(fixture.store('manifest-1')).toMatchObject({ version: 2 });
	});

	// The defect: once a manifest is closed the service re-derives its members by the same fuzzy query a
	// draft uses — the location, the carrier, the service and the window, with `unclaimedOnly` dropped —
	// because the shipment capability it holds exposes no way to ask for "the shipments that carry this
	// manifest id". A parcel shipped after the close, inside the same window, is therefore reported as a
	// member of a manifest that was frozen before it existed, and `recomputeCaches` would count it into
	// the totals a carrier invoice is checked against. `INV-24` states the opposite: after `CLOSED` the
	// membership set is fixed and no fulfilment is added to or removed from it.
	// (`carrier-manifest.service.ts`, `membersOf`, line 313: `unclaimedOnly: manifest.status ===
	// CarrierManifestStatus.DRAFT`, which is the only narrowing the port is given.)
	it('[DEFECT] keeps the membership it froze at close, so a later shipment in the same window is not a member', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1')],
			shipments: [shipped('a')]
		});

		await fixture.service.close('manifest-1');
		// A second parcel leaves the dock after the manifest was frozen, on the same carrier and service,
		// inside the same window.
		fixture.capability.shipments.push(shipped('late'));

		const resolved = await fixture.service.findOneDetailed('manifest-1');

		expect(resolved.members.map((member) => member.fulfillmentId)).toEqual(['a']);
		expect(resolved.shipmentCount).toBe(1);
	});
});

describe('CarrierManifestService — the carrier taking custody (doc 09 §14.7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(DOCK_OPERATOR);
	});

	afterEach(() => jest.restoreAllMocks());

	const closedFixture = () =>
		manifestFixture({
			manifests: [manifestRow('manifest-1', { status: CarrierManifestStatus.CLOSED })],
			shipments: [shipped('a'), shipped('b')]
		});

	it('records the acceptance, the operator and the scan count', async () => {
		const fixture = closedFixture();
		// The members are the shipments that carry the manifest id, so the fixture claims them as the
		// close would have.
		fixture.capability.shipments.forEach((shipment) => (shipment.claimedBy = 'manifest-1'));

		const handedOver = await fixture.service.handOver('manifest-1', { scanCount: 2, note: 'Signed for.' });

		expect(handedOver).toMatchObject({
			status: CarrierManifestStatus.HANDED_OVER,
			note: 'Signed for.',
			version: 2,
			metadata: { scanCount: 2, handedOverByUserId: DOCK_OPERATOR, reconciliation: [] }
		});
		expect(handedOver.handedOverAt).toBeInstanceOf(Date);
	});

	it('defaults the scan count to the number of members', async () => {
		const fixture = closedFixture();
		fixture.capability.shipments.forEach((shipment) => (shipment.claimedBy = 'manifest-1'));

		const handedOver = await fixture.service.handOver('manifest-1');

		expect(handedOver.metadata.scanCount).toBe(2);
	});

	it('writes a scanned parcel the manifest does not carry to the reconciliation list and never to the membership', async () => {
		// A disagreement with the carrier is a fact to be recorded rather than a row to be edited.
		const fixture = closedFixture();
		fixture.capability.shipments.forEach((shipment) => (shipment.claimedBy = 'manifest-1'));

		const handedOver = await fixture.service.handOver('manifest-1', {
			scannedTrackingNumbers: ['TRACK-a', 'TRACK-not-on-the-manifest', 'TRACK-b']
		});

		expect(handedOver.metadata.reconciliation).toEqual(['TRACK-not-on-the-manifest']);
		expect(handedOver.members.map((member) => member.fulfillmentId)).toEqual(['a', 'b']);
	});

	it('refuses to hand over a manifest the carrier was never offered, which is a manifest not yet closed', async () => {
		// Custody can only pass for a manifest that was closed: a draft is still being assembled.
		for (const status of [CarrierManifestStatus.DRAFT, CarrierManifestStatus.CANCELED]) {
			const fixture = manifestFixture({
				manifests: [manifestRow('manifest-1', { status })],
				shipments: [shipped('a')]
			});

			await expect(fixture.service.handOver('manifest-1')).rejects.toThrow(
				/cannot be handed over; close it first/
			);
			expect(fixture.store('manifest-1')).toMatchObject({ status, version: 1 });
		}
	});

	it('refuses a second hand-over of the same manifest', async () => {
		const fixture = closedFixture();
		fixture.capability.shipments.forEach((shipment) => (shipment.claimedBy = 'manifest-1'));

		await fixture.service.handOver('manifest-1');

		await expect(fixture.service.handOver('manifest-1')).rejects.toThrow(/MANIFEST_ILLEGAL_TRANSITION/);
		expect(fixture.store('manifest-1')).toMatchObject({ status: CarrierManifestStatus.HANDED_OVER, version: 2 });
	});
});

describe('CarrierManifestService — withdrawing a manifest (doc 09 §14.7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(DOCK_OPERATOR);
	});

	afterEach(() => jest.restoreAllMocks());

	it('cancels a manifest before hand-over and returns its members to the pool', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1', { status: CarrierManifestStatus.CLOSED })],
			shipments: [shipped('a', { claimedBy: 'manifest-1' }), shipped('b', { claimedBy: 'manifest-1' })]
		});

		const cancelled = await fixture.service.cancel('manifest-1', 'The collection was missed.');

		expect(fixture.capability.releases).toEqual([{ manifestId: 'manifest-1', fulfillmentIds: ['a', 'b'] }]);
		expect(cancelled).toMatchObject({
			status: CarrierManifestStatus.CANCELED,
			note: 'The collection was missed.',
			version: 2
		});
		expect(cancelled.canceledAt).toBeInstanceOf(Date);
		// The pool a later draft derives from is the shipments with no manifest id again.
		expect(fixture.capability.shipments.every((shipment) => shipment.claimedBy === null)).toBe(true);
	});

	it('cancels a draft that was never closed', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1')],
			shipments: [shipped('a')]
		});

		expect((await fixture.service.cancel('manifest-1')).status).toBe(CarrierManifestStatus.CANCELED);
	});

	it('refuses to cancel a manifest the carrier already took, which is a dispute rather than a data change', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1', { status: CarrierManifestStatus.HANDED_OVER })],
			shipments: [shipped('a', { claimedBy: 'manifest-1' })]
		});

		await expect(fixture.service.cancel('manifest-1')).rejects.toThrow(/MANIFEST_ILLEGAL_TRANSITION/);
		expect(fixture.capability.releases).toEqual([]);
		expect(fixture.store('manifest-1')).toMatchObject({ status: CarrierManifestStatus.HANDED_OVER, version: 1 });
	});

	it('refuses to cancel a manifest that is already cancelled', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1', { status: CarrierManifestStatus.CANCELED, metadata: { cancelReason: 'first' } })]
		});

		await expect(fixture.service.cancel('manifest-1', 'second')).rejects.toThrow(/MANIFEST_ILLEGAL_TRANSITION/);
		expect(fixture.store('manifest-1')).toMatchObject({ metadata: { cancelReason: 'first' }, version: 1 });
	});
});

describe('CarrierManifestService — the totals are recomputed from the members (doc 09 §14.7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(DOCK_OPERATOR);
	});

	afterEach(() => jest.restoreAllMocks());

	it('rewrites drifted counters back to what the members hold', async () => {
		// The counters are frozen at close and re-derived by the reconciliation job afterwards; a counter
		// that drifts is worse than no counter, because it is believed.
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1', { shipmentCount: 99, packageCount: 99, totalWeight: '99.0000' })],
			shipments: [
				shipped('a', { packageCount: 4, packedWeight: '1.25' }),
				shipped('b', { packageCount: 1, packedWeight: '0.75' })
			]
		});

		await fixture.service.recomputeCaches('manifest-1');

		expect(fixture.store('manifest-1')).toMatchObject({
			shipmentCount: 2,
			packageCount: 5,
			totalWeight: '2.000000'
		});
	});

	it('reports zero for a manifest whose members are all gone', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1', { shipmentCount: 3 })],
			shipments: []
		});

		await fixture.service.recomputeCaches('manifest-1');

		expect(fixture.store('manifest-1')).toMatchObject({ shipmentCount: 0, packageCount: 0, totalWeight: '0.000000' });
	});

	it('reports a manifest of another organization as missing', async () => {
		const fixture = manifestFixture({ manifests: [manifestRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.resolveMembers('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

/**
 * The property `INV-24` states, walked through the whole machine: a parcel is claimed by exactly one
 * manifest, the claim survives every transition that does not release it, and the totals describe the
 * parcels that were actually handed over.
 */
describe('CarrierManifestService — a parcel appears on one manifest (INV-24)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(DOCK_OPERATOR);
	});

	afterEach(() => jest.restoreAllMocks());

	it('claims each member once, and a second draft cannot collect what the first one froze', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1'), manifestRow('manifest-2')]
		});
		fixture.capability.shipments.push(shipped('a'), shipped('b'));

		await fixture.service.close('manifest-1');

		// The second draft is opened on the same carrier, service and window, and the parcels are already
		// spoken for.
		expect((await fixture.service.resolveMembers('manifest-2')).members).toEqual([]);
		await expect(fixture.service.close('manifest-2')).rejects.toThrow(/MANIFEST_EMPTY/);
		expect(fixture.capability.claims).toHaveLength(1);
	});

	it('hands a withdrawn manifest’s parcels back to the pool a later draft collects from', async () => {
		const fixture = manifestFixture({
			manifests: [manifestRow('manifest-1'), manifestRow('manifest-2')]
		});
		fixture.capability.shipments.push(shipped('a'));

		await fixture.service.close('manifest-1');
		await fixture.service.cancel('manifest-1');

		expect((await fixture.service.resolveMembers('manifest-2')).members.map((m) => m.fulfillmentId)).toEqual(['a']);
		expect((await fixture.service.close('manifest-2')).shipmentCount).toBe(1);
	});

	it('leaves the membership and the totals untouched when the carrier takes custody', async () => {
		const fixture = manifestFixture({ manifests: [manifestRow('manifest-1')] });
		fixture.capability.shipments.push(shipped('a', { packageCount: 2, packedWeight: '1' }));

		const closed = await fixture.service.close('manifest-1');
		const handedOver = await fixture.service.handOver('manifest-1', { scannedTrackingNumbers: ['TRACK-a'] });

		expect(handedOver).toMatchObject({
			shipmentCount: closed.shipmentCount,
			packageCount: closed.packageCount,
			totalWeight: closed.totalWeight
		});
		expect(fixture.capability.claims).toHaveLength(1);
	});
});
