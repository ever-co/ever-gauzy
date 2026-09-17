import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import {
	CarrierManifestStatus,
	IWarehouseFulfillmentPort,
	IWarehouseShippedFulfillment,
	MANIFEST_NUMBER_KEY,
	WAREHOUSE_FULFILLMENT
} from '../warehouse.types';
import { sumQuantities } from '../warehouse.quantity';
import { CarrierManifest } from './carrier-manifest.entity';
import { MikroOrmCarrierManifestRepository } from './repository/mikro-orm-carrier-manifest.repository';
import { TypeOrmCarrierManifestRepository } from './repository/type-orm-carrier-manifest.repository';

/** A manifest and the shipments it currently covers, as the service answers with them. */
export type CarrierManifestWithMembers = CarrierManifest & { members: IWarehouseShippedFulfillment[] };

/**
 * The metadata key a closed manifest records its frozen membership under: the ids of the shipments it
 * was closed over, written in the same statement that moves it to `CLOSED`.
 */
const MANIFEST_MEMBERS_KEY = 'memberFulfillmentIds';

/**
 * The custody boundary: the parcels handed to a carrier at one dock, at one time, with one scan.
 *
 * Membership is **derived while the manifest is a draft and frozen at close**. A draft resolves its
 * members as every shipment at the location with the matching carrier and service, shipped inside the
 * manifest's window and not yet claimed by another manifest; closing writes the manifest id onto each
 * of those shipments in one transaction, which is what stops a parcel appearing on two manifests and
 * what makes the manifest reproducible after the fact.
 *
 * The membership itself is recorded on the manifest at the same moment, because the window a draft
 * derives from stays open after the close: asking that window again would report a parcel shipped
 * later as a member of a manifest frozen before it existed. What a closed manifest reports is
 * therefore the membership it recorded, and never the pool as it stands now.
 *
 * That is also why no column is added to the fulfilment side beyond the metadata key, and why this
 * table holds no member table: a manifest covers shipments, a shipment may contain several packages,
 * and the shipment is the row that knows which carrier took it.
 */
@Injectable()
export class CarrierManifestService extends TenantAwareCrudService<CarrierManifest> {
	constructor(
		readonly typeOrmCarrierManifestRepository: TypeOrmCarrierManifestRepository,
		readonly mikroOrmCarrierManifestRepository: MikroOrmCarrierManifestRepository,
		private readonly sequenceService: SequenceService,
		@Optional()
		@Inject(WAREHOUSE_FULFILLMENT)
		private readonly fulfillment?: IWarehouseFulfillmentPort
	) {
		super(typeOrmCarrierManifestRepository, mikroOrmCarrierManifestRepository);
	}

	/**
	 * Creates a draft manifest for a carrier, a day and a window.
	 *
	 * @param entity The manifest to create.
	 * @returns The created manifest.
	 */
	public async create(entity: Partial<CarrierManifest>): Promise<CarrierManifest> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (!entity.warehouseId) {
			throw new BadRequestException('A manifest must name the location the parcels leave from.');
		}

		if (!entity.carrier) {
			throw new BadRequestException('A manifest must name the carrier it is handed to.');
		}

		const number = await this.allocateNumber();

		return await super.create({
			...entity,
			number,
			status: CarrierManifestStatus.DRAFT,
			manifestDate: entity.manifestDate ?? new Date(),
			shipmentCount: 0,
			packageCount: 0,
			totalWeight: '0.0000',
			version: 1,
			tenantId,
			organizationId
		} as any);
	}

	/**
	 * Reads the members a draft currently covers.
	 *
	 * @param id The manifest.
	 * @returns The manifest and its members.
	 * @throws BadRequestException when no fulfilment capability is registered.
	 */
	public async resolveMembers(id: ID): Promise<CarrierManifestWithMembers> {
		const manifest = await this.findOneScoped(id);

		return { ...manifest, members: await this.membersOf(manifest) };
	}

	/**
	 * Closes a draft: membership is frozen on every member, in one transaction.
	 *
	 * Two things are refused, and both are the difference between a manifest and a list: an empty
	 * manifest is not a hand-over, and a member without a tracking number is a parcel the carrier cannot
	 * be asked about.
	 *
	 * @param id The manifest.
	 * @returns The closed manifest.
	 * @throws BadRequestException with `MANIFEST_EMPTY` or `MANIFEST_FULFILLMENT_NOT_SHIPPED`.
	 */
	public async close(id: ID): Promise<CarrierManifestWithMembers> {
		const manifest = await this.findOneScoped(id);

		if (manifest.status !== CarrierManifestStatus.DRAFT) {
			throw new BadRequestException(
				`MANIFEST_ILLEGAL_TRANSITION: a manifest in status "${manifest.status}" cannot be closed.`
			);
		}

		const members = await this.membersOf(manifest);

		if (!members.length) {
			throw new BadRequestException('MANIFEST_EMPTY: the manifest covers no shipment, so there is nothing to hand over.');
		}

		const untracked = members.filter((member) => !member.trackingNumber);

		if (untracked.length) {
			throw new BadRequestException(
				`MANIFEST_FULFILLMENT_NOT_SHIPPED: ${untracked.length} member shipment(s) carry no tracking number.`
			);
		}

		await this.fulfillment?.claimForManifest({
			manifestId: manifest.id,
			fulfillmentIds: members.map((member) => member.fulfillmentId)
		});

		const totals = summarize(members);

		await super.update(id, {
			status: CarrierManifestStatus.CLOSED,
			closedAt: new Date(),
			shipmentCount: members.length,
			packageCount: totals.packageCount,
			totalWeight: totals.totalWeight,
			// The membership is recorded as it is frozen: it is what every later read answers with, and the
			// only thing that keeps a parcel shipped afterwards out of a manifest it was never on.
			metadata: {
				...(manifest.metadata ?? {}),
				[MANIFEST_MEMBERS_KEY]: members.map((member) => String(member.fulfillmentId))
			},
			version: (manifest.version ?? 1) + 1
		} as any);

		return await this.findOneDetailed(id);
	}

	/**
	 * Records the carrier taking custody at the dock.
	 *
	 * A parcel the carrier scanned that the manifest does not carry is written to the reconciliation list
	 * and reported, never appended to the membership: the membership is what was handed over, and a
	 * disagreement with the carrier is a fact to be recorded rather than a row to be edited.
	 *
	 * @param id The manifest.
	 * @param input What the dock recorded.
	 * @returns The handed-over manifest.
	 */
	public async handOver(
		id: ID,
		input: { scanCount?: number; scannedTrackingNumbers?: string[]; note?: string } = {}
	): Promise<CarrierManifestWithMembers> {
		const manifest = await this.findOneScoped(id);

		if (manifest.status !== CarrierManifestStatus.CLOSED) {
			throw new BadRequestException(
				`MANIFEST_ILLEGAL_TRANSITION: a manifest in status "${manifest.status}" cannot be handed over; close it first.`
			);
		}

		const members = await this.membersOf(manifest);
		const known = new Set(members.map((member) => String(member.trackingNumber ?? '')));
		const reconciliation = (input.scannedTrackingNumbers ?? []).filter(
			(trackingNumber) => !known.has(String(trackingNumber))
		);

		await super.update(id, {
			status: CarrierManifestStatus.HANDED_OVER,
			handedOverAt: new Date(),
			note: input.note ?? manifest.note,
			metadata: {
				...(manifest.metadata ?? {}),
				scanCount: input.scanCount ?? members.length,
				handedOverByUserId: RequestContext.currentUserId(),
				reconciliation
			},
			version: (manifest.version ?? 1) + 1
		} as any);

		return await this.findOneDetailed(id);
	}

	/**
	 * Cancels a manifest that the carrier has not taken.
	 *
	 * Its members are released back to the pool a later draft derives from. A handed-over manifest is
	 * never cancelled: custody has passed, and reversing that is a carrier dispute rather than a data
	 * change.
	 *
	 * @param id The manifest.
	 * @param reason Why it was withdrawn.
	 * @returns The cancelled manifest.
	 */
	public async cancel(id: ID, reason?: string): Promise<CarrierManifestWithMembers> {
		const manifest = await this.findOneScoped(id);

		if (![CarrierManifestStatus.DRAFT, CarrierManifestStatus.CLOSED].includes(manifest.status)) {
			throw new BadRequestException(
				`MANIFEST_ILLEGAL_TRANSITION: a manifest in status "${manifest.status}" cannot be cancelled.`
			);
		}

		const members = await this.membersOf(manifest);

		await this.fulfillment?.releaseFromManifest({
			manifestId: manifest.id,
			fulfillmentIds: members.map((member) => member.fulfillmentId)
		});

		await super.update(id, {
			status: CarrierManifestStatus.CANCELED,
			canceledAt: new Date(),
			note: reason ?? manifest.note,
			version: (manifest.version ?? 1) + 1
		} as any);

		return await this.findOneDetailed(id);
	}

	/**
	 * Re-derives the manifest's caches from its members.
	 *
	 * The counters are frozen at close and re-derived by the reconciliation job afterwards; a counter
	 * that drifts is worse than no counter, because it is believed.
	 *
	 * @param id The manifest.
	 */
	public async recomputeCaches(id: ID): Promise<void> {
		const manifest = await this.findOneScoped(id);
		const members = await this.membersOf(manifest);
		const totals = summarize(members);

		await super.update(id, {
			shipmentCount: members.length,
			packageCount: totals.packageCount,
			totalWeight: totals.totalWeight,
			version: (manifest.version ?? 1) + 1
		} as any);
	}

	/**
	 * Reads a manifest.
	 *
	 * @param id The manifest.
	 * @returns The manifest, with the shipments it currently covers.
	 */
	public async findOneDetailed(id: ID): Promise<CarrierManifestWithMembers> {
		const manifest = await this.typeOrmCarrierManifestRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!manifest) {
			throw new NotFoundException('The carrier manifest was not found.');
		}

		return { ...manifest, members: await this.membersOf(manifest) };
	}

	/**
	 * Reads a manifest inside the caller's tenant and organization.
	 *
	 * @param id The manifest.
	 * @returns The manifest.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<CarrierManifest> {
		const manifest = await this.typeOrmCarrierManifestRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!manifest) {
			throw new NotFoundException('The carrier manifest was not found.');
		}

		return manifest;
	}

	/**
	 * @param manifest The manifest.
	 * @returns The shipments it covers, read from the fulfilment capability.
	 *
	 * A draft's membership is derived: the capability is asked for the shipments at the location that
	 * match the carrier, the service and the window — unclaimed ones only, so a parcel another manifest
	 * already froze is never collected twice.
	 *
	 * A closed manifest reports the membership it recorded at close, never the window as it stands now.
	 * The window outlives the close, so a parcel shipped after it, on the same carrier and service,
	 * would otherwise be reported as a member — and counted into the totals a carrier invoice is checked
	 * against. The record is read back through the same window query because the capability exposes no
	 * way to ask for one manifest's parcels by id; a manifest closed before the record existed carries
	 * none, and is read the way it was read then.
	 */
	private async membersOf(manifest: CarrierManifest): Promise<IWarehouseShippedFulfillment[]> {
		if (!this.fulfillment) {
			return [];
		}

		const query = {
			warehouseId: manifest.warehouseId,
			carrier: manifest.carrier,
			service: manifest.service,
			windowFrom: manifest.windowFrom,
			windowTo: manifest.windowTo
		};

		if (manifest.status === CarrierManifestStatus.DRAFT) {
			return await this.fulfillment.listShipped({ ...query, unclaimedOnly: true });
		}

		const recorded = recordedMemberIds(manifest);

		if (!recorded) {
			return await this.fulfillment.listShipped(query);
		}

		const pool = await this.fulfillment.listShipped(query);

		return pool.filter((member) => recorded.has(String(member.fulfillmentId)));
	}

	/**
	 * Allocates the next manifest number from the platform numbering series.
	 *
	 * @returns The formatted number.
	 * @throws BadRequestException when the organization has no `MANIFEST` series.
	 */
	private async allocateNumber(): Promise<string> {
		try {
			const allocated = await this.sequenceService.allocate(MANIFEST_NUMBER_KEY);

			return allocated.formatted;
		} catch (error) {
			throw new BadRequestException(
				`No numbering series is configured for manifests (key "${MANIFEST_NUMBER_KEY}"), so a manifest number cannot be allocated.`
			);
		}
	}
}

/**
 * @param manifest The manifest.
 * @returns The shipment ids its close recorded, or undefined for a manifest that records none — one
 * closed before the record existed, which is read through the window as it always was.
 */
function recordedMemberIds(manifest: CarrierManifest): Set<string> | undefined {
	const recorded = manifest.metadata?.[MANIFEST_MEMBERS_KEY];

	if (!Array.isArray(recorded)) {
		return undefined;
	}

	return new Set(recorded.map(String));
}

/**
 * @param members The shipments a manifest covers.
 * @returns The package count and the total packed weight of the members.
 */
function summarize(members: IWarehouseShippedFulfillment[]): { packageCount: number; totalWeight: string } {
	let packageCount = 0;
	const weights: string[] = [];

	for (const member of members) {
		packageCount += Number(member.packageCount ?? 1);
		weights.push(member.packedWeight ?? '0');
	}

	return { packageCount, totalWeight: sumQuantities(weights) };
}
