import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import { PickListService } from '../pick-list/pick-list.service';
import { PickListLineService } from '../pick-list-line/pick-list-line.service';
import { PickListLine } from '../pick-list-line/pick-list-line.entity';
import {
	PACK_NUMBER_KEY,
	PackSlipStatus,
	PickListLineStatus,
	PickListStatus
} from '../warehouse.types';
import { normalizeQuantity } from '../warehouse.quantity';
import { TWarehouseRows, warehouseRowsOf } from '../warehouse-persistence';
import { PackSlip } from './pack-slip.entity';
import { MikroOrmPackSlipRepository } from './repository/mikro-orm-pack-slip.repository';
import { TypeOrmPackSlipRepository } from './repository/type-orm-pack-slip.repository';

/**
 * Packing: the record of what went into which package, and the weight a carrier rates.
 *
 * A slip is created from work that is already picked and it covers the lines of one list, which is what
 * makes "a picked unit is never left unpacked" checkable: every picked line of the list is attached to
 * the slip when it is created, so packing validates a set rather than a claim.
 *
 * The machine has exactly two transitions — `OPEN → PACKED` and `OPEN → CANCELED` — and a `PACKED` slip
 * is immutable. A re-pack cancels the slip and creates a new one, so the first packing survives in the
 * history and the label is produced against a record that cannot change underneath it.
 *
 * A slip carries no manifest reference. A manifest covers shipments, a shipment may contain several
 * packages, and the shipment is the row that knows which carrier took it.
 */
@Injectable()
export class PackSlipService extends TenantAwareCrudService<PackSlip> {
	constructor(
		readonly typeOrmPackSlipRepository: TypeOrmPackSlipRepository,
		readonly mikroOrmPackSlipRepository: MikroOrmPackSlipRepository,
		private readonly pickListService: PickListService,
		private readonly pickListLineService: PickListLineService,
		private readonly sequenceService: SequenceService
	) {
		super(typeOrmPackSlipRepository, mikroOrmPackSlipRepository);
	}

	/**
	 * The repository one of this package's tables is read and edited through outside the platform's CRUD
	 * path, on the ORM the installation runs: the TypeORM repository itself under TypeORM — the call it
	 * always was — and the same calls answered through MikroORM under MikroORM, through this service's own
	 * MikroORM repository's entity manager (`warehouse-persistence.ts`).
	 *
	 * @param entity The table's entity.
	 * @param typeOrm Its TypeORM repository, reached only under TypeORM.
	 * @returns The repository.
	 */
	private rows<T extends ObjectLiteral>(entity: new () => T, typeOrm: () => Repository<T>): TWarehouseRows<T> {
		return warehouseRowsOf(this.ormType, entity, typeOrm, () => this.mikroOrmPackSlipRepository);
	}

	/**
	 * Creates a slip from a picked list, and attaches the lines it covers.
	 *
	 * @param entity The slip to create.
	 * @returns The created slip, with the lines it covers.
	 */
	public async create(entity: Partial<PackSlip>): Promise<PackSlip> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (!entity.warehouseId) {
			throw new BadRequestException('A pack slip must name the location the packing happens at.');
		}

		if (!entity.pickListId && !entity.fulfillmentId) {
			throw new BadRequestException(
				'A pack slip is created from a picked list or against a shipment; one of the two is required.'
			);
		}

		if (entity.pickListId) {
			const list = await this.pickListService.findOneScoped(entity.pickListId);

			if (list.status !== PickListStatus.PICKED) {
				throw new BadRequestException(
					`A pack slip is created from a picked list; this one is in status "${list.status}".`
				);
			}
		}

		const number = await this.allocateNumber();

		const slip = await super.create({
			...entity,
			number,
			status: PackSlipStatus.OPEN,
			packageCount: entity.packageCount ?? 1,
			version: 1,
			tenantId,
			organizationId
		} as any);

		if (slip.pickListId) {
			await this.pickListLineService.attachToPackSlip(slip.pickListId, slip.id);
		}

		return await this.findOneDetailed(slip.id);
	}

	/**
	 * Seals a slip: the packages and the weights are recorded and the slip becomes immutable.
	 *
	 * Every line of the list the slip covers has to carry an outcome before this succeeds — a picked unit
	 * left unpacked is a shipment that arrives short and nobody knows why.
	 *
	 * @param id The slip.
	 * @param content What the bench measured.
	 * @returns The packed slip.
	 * @throws BadRequestException with `PACK_SLIP_INCOMPLETE` when a line of the list has no outcome, and
	 * with `PACK_SLIP_TRACKING_DUPLICATE` when the tracking number is already attached to another slip of
	 * the same carrier.
	 */
	public async pack(
		id: ID,
		content: {
			packageCount: number;
			totalWeight?: string;
			totalVolume?: string;
			carrierKey?: string;
			trackingNumber?: string;
			labelUrl?: string;
			note?: string;
		}
	): Promise<PackSlip> {
		const slip = await this.findOneScoped(id);

		if (slip.status !== PackSlipStatus.OPEN) {
			throw new BadRequestException(
				`A slip in status "${slip.status}" is closed; a re-pack cancels it and creates a new one.`
			);
		}

		const lines = await this.linesOfSlip(slip);

		if (!lines.length) {
			throw new BadRequestException(
				'PACK_SLIP_INCOMPLETE: this slip covers no line of the list it was created from.'
			);
		}

		const incomplete = lines.filter(
			(line) => line.status === PickListLineStatus.PENDING || line.status === PickListLineStatus.CANCELED
		);

		if (incomplete.length) {
			throw new BadRequestException(
				`PACK_SLIP_INCOMPLETE: ${incomplete.length} line(s) this slip covers have no outcome.`
			);
		}

		if (content.trackingNumber) {
			await this.assertTrackingNumberIsFree(content.carrierKey ?? slip.carrierKey, content.trackingNumber);
		}

		const packageCount = Number(content.packageCount ?? slip.packageCount);

		if (!Number.isInteger(packageCount) || packageCount < 1) {
			throw new BadRequestException('A packed slip holds at least one package.');
		}

		await super.update(id, {
			status: PackSlipStatus.PACKED,
			packageCount,
			totalWeight: content.totalWeight ? normalizeQuantity(content.totalWeight) : slip.totalWeight,
			totalVolume: content.totalVolume ? normalizeQuantity(content.totalVolume) : slip.totalVolume,
			carrierKey: content.carrierKey ?? slip.carrierKey,
			trackingNumber: content.trackingNumber ?? slip.trackingNumber,
			labelUrl: content.labelUrl ?? slip.labelUrl,
			packedAt: new Date(),
			packedByUserId: RequestContext.currentUserId(),
			note: content.note ?? slip.note,
			version: (slip.version ?? 1) + 1
		} as any);

		return await this.findOneDetailed(id);
	}

	/**
	 * Cancels a slip that was never packed.
	 *
	 * The picked lines are detached rather than rewritten: the picked quantity is what physically
	 * happened, and a cancellation is a statement about the package.
	 *
	 * @param id The slip.
	 * @param reason Why it was abandoned.
	 * @returns The cancelled slip.
	 */
	public async cancel(id: ID, reason?: string): Promise<PackSlip> {
		const slip = await this.findOneScoped(id);

		if (slip.status !== PackSlipStatus.OPEN) {
			throw new BadRequestException(
				`A slip in status "${slip.status}" cannot be cancelled; only an open slip can be.`
			);
		}

		await this.pickListLineService.detachFromPackSlip(id);

		await super.update(id, {
			status: PackSlipStatus.CANCELED,
			note: reason ?? slip.note,
			version: (slip.version ?? 1) + 1
		} as any);

		return await this.findOneDetailed(id);
	}

	/**
	 * Reads a slip.
	 *
	 * @param id The slip.
	 * @returns The slip, with the lines it covers.
	 */
	public async findOneDetailed(id: ID): Promise<PackSlip> {
		const slip = await this.rows(PackSlip, () => this.typeOrmPackSlipRepository).findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { lines: true }
		});

		if (!slip) {
			throw new NotFoundException('The pack slip was not found.');
		}

		return slip;
	}

	/**
	 * Reads a slip inside the caller's tenant and organization.
	 *
	 * @param id The slip.
	 * @returns The slip.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<PackSlip> {
		const slip = await this.rows(PackSlip, () => this.typeOrmPackSlipRepository).findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!slip) {
			throw new NotFoundException('The pack slip was not found.');
		}

		return slip;
	}

	/**
	 * @param slip The slip.
	 * @returns The lines attached to it.
	 */
	private async linesOfSlip(slip: PackSlip): Promise<PickListLine[]> {
		if (!slip.pickListId) {
			return [];
		}

		const lines = await this.pickListLineService.findForList(slip.pickListId);

		return lines.filter((line) => String(line.packSlipId ?? '') === String(slip.id));
	}

	/**
	 * @param carrierKey The carrier.
	 * @param trackingNumber The tracking number.
	 * @throws BadRequestException when another live slip already carries it.
	 */
	private async assertTrackingNumberIsFree(carrierKey: string | undefined, trackingNumber: string): Promise<void> {
		const existing = await this.rows(PackSlip, () => this.typeOrmPackSlipRepository).findOne({
			where: {
				carrierKey,
				trackingNumber,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (existing) {
			throw new BadRequestException(
				`PACK_SLIP_TRACKING_DUPLICATE: tracking number ${trackingNumber} is already attached to slip ${existing.number}.`
			);
		}
	}

	/**
	 * Allocates the next slip number from the platform numbering series.
	 *
	 * @returns The formatted number.
	 * @throws BadRequestException when the organization has no `PACK` series.
	 */
	private async allocateNumber(): Promise<string> {
		try {
			const allocated = await this.sequenceService.allocate(PACK_NUMBER_KEY);

			return allocated.formatted;
		} catch (error) {
			throw new BadRequestException(
				`No numbering series is configured for packing (key "${PACK_NUMBER_KEY}"), so a pack slip number cannot be allocated.`
			);
		}
	}
}
