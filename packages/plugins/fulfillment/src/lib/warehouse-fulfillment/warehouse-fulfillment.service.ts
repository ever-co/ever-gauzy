import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Between, FindOptionsWhere, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import { FulfillmentDirection, FulfillmentStatusDetail, ID } from '@gauzy/contracts';
import { RequestContext, normalizeDecimalString } from '@gauzy/core';
import { OrderLineService } from '@gauzy/plugin-order';
import type { OrderLine } from '@gauzy/plugin-order';
import { IShippableLine, IShippedShipment } from '../fulfillment.types';
import { Fulfillment } from '../fulfillment/fulfillment.entity';
import { FulfillmentService } from '../fulfillment/fulfillment.service';
import { FulfillmentLine } from '../fulfillment-line/fulfillment-line.entity';
import { FulfillmentLineService } from '../fulfillment-line/fulfillment-line.service';

/**
 * The metadata member a manifest freezes its membership onto.
 *
 * The link lives here rather than in a column because a shipment is handed over once and a manifest
 * is a list of what was handed over: the shipment is the row that knows, and the parcel that appears
 * on two manifests is exactly what this member prevents. It is read and written through the
 * shipment's open-ended payload, which is what the table keeps for identifiers its own columns do not
 * name.
 */
const MANIFEST_KEY = 'manifestId';

/**
 * The shipment side of the work a location does: what has to leave, and what already has.
 *
 * A picking list is not authored, it is derived — the quantities it asks for are the quantities the
 * shipments still need — and a carrier manifest is not a list somebody keeps, it is the set of
 * shipments a carrier took at one dock. Both are questions only this package can answer, because
 * `fulfillment` and `fulfillment_line` are where a shipment and its contents are recorded, so this
 * class answers them and owns no table, no rule and no counter of its own.
 *
 * Four answers, and where each comes from:
 *
 * - **The lines to pick** are the lines of the shipments that are *due to leave* the named location:
 *   `fulfillment_line` rows whose shipment is `PENDING`, `OUTBOUND` and physical. A shipment that has
 *   been handed over, a return leg and a digital delivery are all absent, because none of them is
 *   work at a bin. The quantity is the line's own recorded quantity — as exact decimal text, never a
 *   floating-point number — and the variant is the one the order line the shipment satisfies names,
 *   since the shipment line stores the order line and not the variant.
 * - **What has shipped** is read from the `fulfillment` row's own columns: the location, the carrier,
 *   the service, the instant it left and the tracking number. "Left" is `shippedAt` being set, which
 *   is the fact the lifecycle writes, so a shipment that is still pending is not in the pool and a
 *   cancelled one never was.
 * - **Claiming** writes `metadata.manifestId` on each named shipment, which is what freezes
 *   membership: a shipment already frozen onto a *different* manifest is refused rather than
 *   silently skipped, because a manifest that covers three of the five parcels it named is a
 *   manifest nobody can hand to a carrier. The write goes through the shipment service, so the row
 *   is loaded, scoped and written by the domain that owns it.
 * - **Releasing** clears that member, and only on the shipments this manifest holds: a release that
 *   cleared another manifest's membership would take a parcel off a manifest the carrier has already
 *   signed for.
 *
 * Every read and every write is scoped to the caller's tenant and organization, so a shipment of
 * another tenant is not found, not counted and not written — which is the same answer whether it
 * does not exist or belongs to somebody else.
 */
@Injectable()
export class WarehouseFulfillmentService {
	constructor(
		private readonly fulfillmentService: FulfillmentService,
		private readonly lineService: FulfillmentLineService,
		private readonly orderLineService: OrderLineService
	) {}

	/**
	 * Reads the lines of the shipments that are due to leave a location.
	 *
	 * @param query The location, and the shipments or the order the work is for when the caller knows
	 * them.
	 * @returns One entry per line the caller may pick, in the order the lines were written. A line
	 * whose variant cannot be resolved, and a line whose own location is not this one, are absent.
	 * @throws BadRequestException when no location was named.
	 */
	public async listShippableLines(query: {
		warehouseId: ID;
		fulfillmentIds?: ID[];
		orderId?: ID;
	}): Promise<IShippableLine[]> {
		const warehouseId = query?.warehouseId;

		if (!warehouseId) {
			throw new BadRequestException(
				'SHIPMENT_LOCATION_REQUIRED: the work a location has to do is read for one named location.'
			);
		}

		const named = query.fulfillmentIds;

		// A caller that named shipments and named none is asking about no shipment: the answer is the
		// empty set rather than every shipment of the location, which is what leaving the filter out
		// would mean.
		if (named && !named.length) {
			return [];
		}

		const shipments = await this.fulfillmentService.find({
			where: {
				...this.scope(),
				warehouseId,
				direction: FulfillmentDirection.OUTBOUND,
				status: FulfillmentStatusDetail.PENDING,
				// A digital delivery has nothing at a bin, so it is not work — the column is what says so,
				// and it is the shipment rather than the line that carries it.
				requiresShipping: true,
				...(named?.length ? { id: In(named) } : {}),
				...(query.orderId ? { orderId: query.orderId } : {})
			} as FindOptionsWhere<Fulfillment>
		});

		if (!shipments.length) {
			return [];
		}

		const lines = await this.lineService.find({
			where: {
				...this.scope(),
				fulfillmentId: In(shipments.map((shipment) => shipment.id))
			} as FindOptionsWhere<FulfillmentLine>,
			order: { id: 'ASC' }
		});

		if (!lines.length) {
			return [];
		}

		const variants = await this.variantsOf(lines);
		const byShipment = new Map(shipments.map((shipment) => [String(shipment.id), shipment]));
		const shippable: IShippableLine[] = [];

		for (const line of lines) {
			const shipment = byShipment.get(String(line.fulfillmentId));

			if (!shipment) {
				continue;
			}

			/**
			 * The line's own location wins over its shipment's. A shipment that spans locations leaves
			 * the units it holds *here* from here, and the units it holds elsewhere are picked there —
			 * asking a picker for goods that are not in the building they are walking is how a pick list
			 * becomes a list of exceptions.
			 */
			const location = line.warehouseId ?? shipment.warehouseId;

			if (String(location ?? '') !== String(warehouseId)) {
				continue;
			}

			/**
			 * The variant is mandatory in the answer, so a line whose order line names none is not
			 * reported at all: the caller allocates a bin per variant, and a line it cannot allocate is
			 * a line nobody can pick. The shipment line stores the order line, so this is a read of the
			 * line the shipment satisfies rather than a guess at what is in the parcel.
			 */
			const variantId = variants.get(String(line.orderLineId));

			if (!variantId) {
				continue;
			}

			shippable.push({
				fulfillmentLineId: line.id,
				fulfillmentId: line.fulfillmentId,
				...(line.orderLineId ? { orderLineId: line.orderLineId } : {}),
				...(shipment.orderId ? { orderId: shipment.orderId } : {}),
				variantId,
				quantity: normalizeDecimalString(line.quantity),
				...(location ? { warehouseId: location } : {})
			});
		}

		return shippable;
	}

	/**
	 * Reads the shipments that have left a location.
	 *
	 * @param query The location, and the carrier, the service, the window or the claimed state to
	 * narrow it by.
	 * @returns The shipments, oldest first, so the same state is always reported in the same order.
	 * @throws BadRequestException when no location was named.
	 */
	public async listShipped(query: {
		warehouseId: ID;
		carrier?: string;
		service?: string;
		windowFrom?: Date;
		windowTo?: Date;
		unclaimedOnly?: boolean;
	}): Promise<IShippedShipment[]> {
		if (!query?.warehouseId) {
			throw new BadRequestException(
				'SHIPMENT_LOCATION_REQUIRED: the shipments of a location are read for one named location.'
			);
		}

		const shipments = await this.fulfillmentService.find({
			where: {
				...this.scope(),
				warehouseId: query.warehouseId,
				/**
				 * Having left is `shippedAt` being set, and nothing else: the lifecycle writes it when the
				 * parcel is handed over, so a pending shipment is not in the pool and a cancelled one — which
				 * can only be cancelled before that moment — never was.
				 */
				shippedAt: this.departedBetween(query.windowFrom, query.windowTo),
				...(query.carrier ? { carrier: query.carrier } : {}),
				...(query.service ? { service: query.service } : {})
			} as FindOptionsWhere<Fulfillment>,
			order: { shippedAt: 'ASC', id: 'ASC' }
		});

		/**
		 * The claimed set is filtered here rather than in the statement, because the claim is a member
		 * of a JSON payload and there is no predicate for "that member is absent" that is the same on
		 * every database this platform runs on. The read is already narrowed to one location, one
		 * carrier, one service and one window — a dock's day of parcels — which is what makes the
		 * filter affordable.
		 */
		const pool = query.unclaimedOnly ? shipments.filter((shipment) => !this.manifestOf(shipment)) : shipments;

		return pool.map((shipment) => ({
			fulfillmentId: shipment.id,
			...(shipment.warehouseId ? { warehouseId: shipment.warehouseId } : {}),
			...(shipment.orderId ? { orderId: shipment.orderId } : {}),
			...(shipment.carrier ? { carrier: shipment.carrier } : {}),
			...(shipment.service ? { service: shipment.service } : {}),
			...(shipment.shippedAt ? { shippedAt: shipment.shippedAt } : {}),
			...(shipment.trackingNumber ? { trackingNumber: shipment.trackingNumber } : {})
		}));
	}

	/**
	 * Freezes the named shipments onto a manifest by writing `metadata.manifestId` on each.
	 *
	 * @param request The manifest, and the shipments it covers.
	 * @returns How many shipments were frozen.
	 * @throws BadRequestException when no manifest was named, or when a named shipment has not left.
	 * @throws NotFoundException when a named shipment is not the caller's, which is also the answer
	 * for one that does not exist.
	 * @throws ConflictException when a named shipment is already frozen onto another manifest.
	 */
	public async claimForManifest(request: { manifestId: ID; fulfillmentIds: ID[] }): Promise<number> {
		const manifestId = request?.manifestId;

		if (!manifestId) {
			throw new BadRequestException(
				'MANIFEST_REFERENCE_REQUIRED: a shipment is claimed by the manifest it is handed over on.'
			);
		}

		const ids = (request.fulfillmentIds ?? []).filter(Boolean);

		if (!ids.length) {
			return 0;
		}

		const shipments = await this.readNamed(ids);

		/**
		 * Both refusals happen before the first write, and neither is absorbed: a manifest that named a
		 * parcel which never left would be a hand-over nobody can reconcile, and a parcel silently
		 * dropped from the claim would be a manifest whose frozen membership is not what its caller
		 * asked for. The membership is written for all of them or for none of them.
		 */
		for (const shipment of shipments) {
			if (!shipment.shippedAt) {
				throw new BadRequestException({
					message: `SHIPMENT_NOT_DEPARTED: shipment '${shipment.id}' has not left a location, so it cannot be frozen onto a manifest.`,
					code: 'SHIPMENT_NOT_DEPARTED',
					details: { fulfillmentId: shipment.id, status: shipment.status }
				});
			}

			const claimedBy = this.manifestOf(shipment);

			if (claimedBy && String(claimedBy) !== String(manifestId)) {
				throw new ConflictException({
					message: `SHIPMENT_ALREADY_MANIFESTED: shipment '${shipment.id}' is already frozen onto manifest '${claimedBy}'.`,
					code: 'SHIPMENT_ALREADY_MANIFESTED',
					details: { fulfillmentId: shipment.id, manifestId: claimedBy }
				});
			}
		}

		for (const shipment of shipments) {
			await this.freeze(shipment, manifestId);
		}

		return shipments.length;
	}

	/**
	 * Returns the named shipments to the pool a later manifest derives from.
	 *
	 * @param request The manifest, and the shipments it covered.
	 * @returns How many shipments were released. A shipment this manifest does not hold — one it never
	 * claimed, one another manifest froze, or one no longer in the caller's scope — is not released
	 * and is not counted.
	 * @throws BadRequestException when no manifest was named.
	 */
	public async releaseFromManifest(request: { manifestId: ID; fulfillmentIds: ID[] }): Promise<number> {
		const manifestId = request?.manifestId;

		if (!manifestId) {
			throw new BadRequestException(
				'MANIFEST_REFERENCE_REQUIRED: a shipment is released from the manifest that claimed it.'
			);
		}

		const ids = (request.fulfillmentIds ?? []).filter(Boolean);

		if (!ids.length) {
			return 0;
		}

		/**
		 * A release names shipments that may have moved on since they were resolved — a manifest that
		 * recorded its membership is read back through the window that produced it, and the window
		 * outlives the close. A shipment this manifest does not hold is therefore an ordinary outcome
		 * here rather than a refusal: clearing another manifest's membership would take a parcel off a
		 * manifest the carrier has already signed for.
		 */
		const shipments = await this.fulfillmentService.find({
			where: {
				...this.scope(),
				id: In(ids)
			} as FindOptionsWhere<Fulfillment>
		});

		let released = 0;

		for (const shipment of shipments) {
			if (String(this.manifestOf(shipment) ?? '') !== String(manifestId)) {
				continue;
			}

			await this.freeze(shipment, undefined);
			released++;
		}

		return released;
	}

	/**
	 * Reads the shipments a caller named, refusing when one of them cannot be read.
	 *
	 * @param ids The shipments.
	 * @returns The shipments, as the caller's own.
	 * @throws NotFoundException when one of them is not the caller's, which is also the answer for one
	 * that does not exist.
	 */
	private async readNamed(ids: ID[]): Promise<Fulfillment[]> {
		const shipments = await this.fulfillmentService.find({
			where: {
				...this.scope(),
				id: In(ids)
			} as FindOptionsWhere<Fulfillment>
		});
		const found = new Set(shipments.map((shipment) => String(shipment.id)));
		const missing = ids.filter((id) => !found.has(String(id)));

		if (missing.length) {
			throw new NotFoundException({
				message: `SHIPMENT_NOT_FOUND: ${missing.length} of the named shipment(s) are not in the caller's organization.`,
				code: 'SHIPMENT_NOT_FOUND',
				details: { fulfillmentIds: missing }
			});
		}

		return shipments;
	}

	/**
	 * Writes, or clears, the manifest a shipment is frozen onto.
	 *
	 * The write goes through the shipment service rather than through a repository, so the row is
	 * loaded inside the caller's scope and the domain that owns shipments is the one writing it. The
	 * payload is merged rather than replaced, because a shipment's open-ended payload also holds what
	 * the carrier integrations put there.
	 *
	 * @param shipment The shipment to write.
	 * @param manifestId The manifest, or nothing to return the shipment to the pool.
	 */
	private async freeze(shipment: Fulfillment, manifestId?: ID): Promise<void> {
		const metadata = { ...(shipment.metadata ?? {}) };

		if (manifestId === undefined) {
			delete metadata[MANIFEST_KEY];
		} else {
			metadata[MANIFEST_KEY] = manifestId;
		}

		await this.fulfillmentService.update(
			{ id: shipment.id, ...this.scope() } as FindOptionsWhere<Fulfillment>,
			{ metadata } as any
		);
	}

	/**
	 * @param shipment A shipment.
	 * @returns The manifest it is frozen onto, when it is frozen onto one.
	 */
	private manifestOf(shipment: Fulfillment): ID | undefined {
		const manifestId = shipment.metadata?.[MANIFEST_KEY];

		return manifestId === undefined || manifestId === null || manifestId === '' ? undefined : (manifestId as ID);
	}

	/**
	 * @param from The start of the window, when the caller stated one.
	 * @param to The end of the window, when the caller stated one.
	 * @returns The condition on `shippedAt` a window states: a range, one open end, or simply "it
	 * left" when no window was stated.
	 */
	private departedBetween(from?: Date, to?: Date): FindOptionsWhere<Fulfillment>['shippedAt'] {
		if (from && to) {
			return Between(from, to);
		}

		if (from) {
			return MoreThanOrEqual(from);
		}

		if (to) {
			return LessThanOrEqual(to);
		}

		return Not(IsNull());
	}

	/**
	 * @param lines The shipment lines being reported.
	 * @returns The variant of each order line they satisfy, by order line.
	 */
	private async variantsOf(lines: FulfillmentLine[]): Promise<Map<string, ID>> {
		const orderLineIds = Array.from(
			new Set(lines.map((line) => line.orderLineId).filter((orderLineId): orderLineId is ID => !!orderLineId))
		);

		if (!orderLineIds.length) {
			return new Map();
		}

		const orderLines: OrderLine[] = await this.orderLineService.find({
			where: {
				...this.scope(),
				id: In(orderLineIds)
			} as FindOptionsWhere<OrderLine>
		});

		return new Map(
			(orderLines ?? [])
				.filter((orderLine) => !!orderLine.variantId)
				.map((orderLine) => [String(orderLine.id), orderLine.variantId])
		);
	}

	/**
	 * @returns The tenant and organization every read and write here is scoped to.
	 */
	private scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}
}
