import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import { PickList } from '../pick-list/pick-list.entity';
import { TypeOrmPickListRepository } from '../pick-list/repository/type-orm-pick-list.repository';
import { PickListLine } from '../pick-list-line/pick-list-line.entity';
import { TypeOrmPickListLineRepository } from '../pick-list-line/repository/type-orm-pick-list-line.repository';
import { PICK_NUMBER_KEY, PickListStatus, PickWaveStatus, PickWaveStrategy } from '../warehouse.types';
import { PickWave } from './pick-wave.entity';
import { MikroOrmPickWaveRepository } from './repository/mikro-orm-pick-wave.repository';
import { TypeOrmPickWaveRepository } from './repository/type-orm-pick-wave.repository';

/**
 * The release unit of warehouse work: the waves an operator releases, assigns, watches and closes.
 *
 * A wave is where "is this batch of work finished?" is answered, so most of this service is a state
 * machine and the checks that go with it. The machine moves forward only — `DRAFT → RELEASED →
 * IN_PROGRESS → PICKED | PARTIALLY_PICKED → CLOSED`, plus `→ CANCELED` while it is still being worked —
 * and the two interesting gates are that a wave may only be released when every line it covers has a
 * bin, and may only be closed when every list under it has reached a terminal state.
 *
 * Cancelling a wave cancels its lists and touches neither reservations nor stock: picking consumes a
 * reservation that checkout already took, so a cancellation is not a stock event.
 */
@Injectable()
export class PickWaveService extends TenantAwareCrudService<PickWave> {
	constructor(
		readonly typeOrmPickWaveRepository: TypeOrmPickWaveRepository,
		readonly mikroOrmPickWaveRepository: MikroOrmPickWaveRepository,
		private readonly typeOrmPickListRepository: TypeOrmPickListRepository,
		private readonly typeOrmPickListLineRepository: TypeOrmPickListLineRepository,
		private readonly sequenceService: SequenceService
	) {
		super(typeOrmPickWaveRepository, mikroOrmPickWaveRepository);
	}

	/**
	 * Creates a wave.
	 *
	 * @param entity The wave to create.
	 * @returns The created wave.
	 */
	public async create(entity: Partial<PickWave>): Promise<PickWave> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (!entity.warehouseId) {
			throw new BadRequestException('A wave must name the location it is worked in.');
		}

		const number = await this.allocateNumber();

		return await super.create({
			...entity,
			number,
			strategy: entity.strategy ?? PickWaveStrategy.BATCH,
			status: PickWaveStatus.DRAFT,
			priority: entity.priority ?? 0,
			orderCount: 0,
			lineCount: 0,
			version: 1,
			tenantId,
			organizationId
		} as any);
	}

	/**
	 * Releases a wave to the floor.
	 *
	 * Release is the gate the whole derivation exists for: a line with no bin is a line nobody can pick,
	 * and releasing it would put work on the floor that cannot be completed.
	 *
	 * @param id The wave.
	 * @param pickerUserId The operator the whole wave is assigned to, when one person takes it.
	 * @returns The released wave.
	 * @throws BadRequestException with `PICK_LINE_UNBINNED` when a line has no bin.
	 */
	public async release(id: ID, pickerUserId?: ID): Promise<PickWave> {
		const wave = await this.findOneScoped(id);

		if (wave.status !== PickWaveStatus.DRAFT) {
			throw new BadRequestException(
				`WAVE_ILLEGAL_TRANSITION: a wave in status "${wave.status}" cannot be released.`
			);
		}

		const lines = await this.linesOfWave(id);
		const unbinned = lines.filter((line) => !line.binId);

		if (unbinned.length) {
			throw new BadRequestException(
				`PICK_LINE_UNBINNED: ${unbinned.length} line(s) of this wave have no bin, so the work cannot be released.`
			);
		}

		await super.update(id, {
			status: PickWaveStatus.RELEASED,
			pickerUserId: pickerUserId ?? wave.pickerUserId,
			releasedAt: new Date(),
			version: (wave.version ?? 1) + 1
		} as any);

		await this.recomputeCaches(id);

		return await this.findOneDetailed(id);
	}

	/**
	 * Marks a wave as being walked.
	 *
	 * @param id The wave.
	 * @returns The started wave.
	 */
	public async start(id: ID): Promise<PickWave> {
		const wave = await this.findOneScoped(id);

		if (wave.status !== PickWaveStatus.RELEASED) {
			throw new BadRequestException(
				`WAVE_ILLEGAL_TRANSITION: a wave in status "${wave.status}" cannot be started.`
			);
		}

		await super.update(id, {
			status: PickWaveStatus.IN_PROGRESS,
			startedAt: wave.startedAt ?? new Date(),
			version: (wave.version ?? 1) + 1
		} as any);

		return await this.findOneDetailed(id);
	}

	/**
	 * Moves a wave whose lists are all done to its picked state.
	 *
	 * The state is derived rather than asserted: a wave with any line closed short is
	 * `PARTIALLY_PICKED`, because the shortfall is a fact about the wave that the packing step and the
	 * backorder decision both read.
	 *
	 * @param id The wave.
	 * @returns The wave in its picked state.
	 * @throws BadRequestException when a list under it is still open.
	 */
	public async complete(id: ID): Promise<PickWave> {
		const wave = await this.findOneScoped(id);

		if (wave.status !== PickWaveStatus.IN_PROGRESS) {
			throw new BadRequestException(
				`WAVE_ILLEGAL_TRANSITION: a wave in status "${wave.status}" cannot be completed.`
			);
		}

		const lists = await this.listsOfWave(id);

		if (!lists.length) {
			throw new BadRequestException('A wave with no pick list has nothing to complete.');
		}

		const open = lists.filter((list) => ![PickListStatus.PICKED, PickListStatus.CANCELED].includes(list.status));

		if (open.length) {
			throw new BadRequestException(
				`PICK_LIST_OPEN: ${open.length} pick list(s) of this wave are still being worked.`
			);
		}

		const lines = await this.linesOfWave(id);
		const short = lines.filter((line) => ['SHORT', 'SKIPPED'].includes(line.status));

		await super.update(id, {
			status: short.length ? PickWaveStatus.PARTIALLY_PICKED : PickWaveStatus.PICKED,
			completedAt: new Date(),
			version: (wave.version ?? 1) + 1
		} as any);

		await this.recomputeCaches(id);

		return await this.findOneDetailed(id);
	}

	/**
	 * Closes a wave short, releasing the work that will not be done.
	 *
	 * This is an operator's decision rather than a derived state: the remaining lines are reported, and
	 * the shortfall drives a backorder or a re-allocation, which is why the wave stops here rather than
	 * pretending the batch was completed.
	 *
	 * @param id The wave.
	 * @param reason Why it was closed short.
	 * @returns The wave, closed short.
	 */
	public async closeShort(id: ID, reason?: string): Promise<PickWave> {
		const wave = await this.findOneScoped(id);

		if ([PickWaveStatus.CLOSED, PickWaveStatus.CANCELED].includes(wave.status)) {
			throw new BadRequestException(
				`WAVE_ILLEGAL_TRANSITION: a wave in status "${wave.status}" is already closed.`
			);
		}

		await super.update(id, {
			status: PickWaveStatus.PARTIALLY_PICKED,
			completedAt: new Date(),
			metadata: { ...(wave.metadata ?? {}), closedShort: true, closedShortReason: reason },
			version: (wave.version ?? 1) + 1
		} as any);

		await this.cancelOpenLists(id, reason ?? 'The wave was closed short.');
		await this.recomputeCaches(id);

		return await this.findOneDetailed(id);
	}

	/**
	 * Closes a wave whose output was packed and manifested.
	 *
	 * @param id The wave.
	 * @returns The closed wave.
	 * @throws BadRequestException when a list under it is still open.
	 */
	public async close(id: ID): Promise<PickWave> {
		const wave = await this.findOneScoped(id);

		if (![PickWaveStatus.PICKED, PickWaveStatus.PARTIALLY_PICKED].includes(wave.status)) {
			throw new BadRequestException(
				`WAVE_ILLEGAL_TRANSITION: a wave in status "${wave.status}" cannot be closed; picking has not finished.`
			);
		}

		const lists = await this.listsOfWave(id);
		const open = lists.filter((list) => ![PickListStatus.PICKED, PickListStatus.CANCELED].includes(list.status));

		if (open.length) {
			throw new BadRequestException(
				`PICK_LIST_OPEN: ${open.length} pick list(s) of this wave are still being worked.`
			);
		}

		await super.update(id, {
			status: PickWaveStatus.CLOSED,
			version: (wave.version ?? 1) + 1
		} as any);

		return await this.findOneDetailed(id);
	}

	/**
	 * Cancels a wave that has not finished.
	 *
	 * The wave's lists are cancelled with it and nothing else moves: no reservation is released and no
	 * movement is written, because the reservations belong to the shipments and a cancellation is not a
	 * stock event.
	 *
	 * @param id The wave.
	 * @param reason Why it was cancelled.
	 * @returns The cancelled wave.
	 */
	public async cancel(id: ID, reason?: string): Promise<PickWave> {
		const wave = await this.findOneScoped(id);

		if (![PickWaveStatus.DRAFT, PickWaveStatus.RELEASED, PickWaveStatus.IN_PROGRESS].includes(wave.status)) {
			throw new BadRequestException(
				`WAVE_ILLEGAL_TRANSITION: a wave in status "${wave.status}" cannot be cancelled.`
			);
		}

		const lines = await this.linesOfWave(id);
		const recorded = lines.filter((line) => line.status !== 'PENDING');

		if (recorded.length) {
			throw new BadRequestException(
				`PICK_LIST_HAS_PICKS: ${recorded.length} line(s) of this wave already have an outcome; close the wave short instead.`
			);
		}

		await this.cancelOpenLists(id, reason ?? 'The wave was cancelled.');

		await super.update(id, {
			status: PickWaveStatus.CANCELED,
			metadata: { ...(wave.metadata ?? {}), cancelReason: reason },
			version: (wave.version ?? 1) + 1
		} as any);

		return await this.findOneDetailed(id);
	}

	/**
	 * Reads a wave.
	 *
	 * @param id The wave.
	 * @returns The wave, with its pick lists.
	 */
	public async findOneDetailed(id: ID): Promise<PickWave> {
		const wave = await this.typeOrmPickWaveRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			relations: { pickLists: true }
		});

		if (!wave) {
			throw new NotFoundException('The pick wave was not found.');
		}

		return wave;
	}

	/**
	 * Reads a wave inside the caller's tenant and organization.
	 *
	 * @param id The wave.
	 * @returns The wave.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<PickWave> {
		const wave = await this.typeOrmPickWaveRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!wave) {
			throw new NotFoundException('The pick wave was not found.');
		}

		return wave;
	}

	/**
	 * Re-derives the wave's caches from its lists and their lines.
	 *
	 * The counters are caches of what the wave covers, and they are recomputed rather than incremented:
	 * a counter that drifts is worse than no counter, because it is believed.
	 *
	 * @param id The wave.
	 */
	public async recomputeCaches(id: ID): Promise<void> {
		const wave = await this.findOneScoped(id);
		const lists = await this.listsOfWave(id);
		const lines = await this.linesOfWave(id);
		const orders = new Set(lists.map((list) => String(list.orderId ?? '')).filter((orderId) => orderId !== ''));

		await super.update(id, {
			orderCount: orders.size,
			lineCount: lines.length,
			version: (wave.version ?? 1) + 1
		} as any);
	}

	/**
	 * @param waveId The wave.
	 * @returns Its pick lists.
	 */
	private async listsOfWave(waveId: ID): Promise<PickList[]> {
		return await this.typeOrmPickListRepository.find({
			where: {
				waveId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});
	}

	/**
	 * @param waveId The wave.
	 * @returns Every line of every list under it.
	 */
	private async linesOfWave(waveId: ID): Promise<PickListLine[]> {
		const lists = await this.listsOfWave(waveId);

		if (!lists.length) {
			return [];
		}

		const lines: PickListLine[] = [];

		for (const list of lists) {
			lines.push(
				...(await this.typeOrmPickListLineRepository.find({
					where: {
						pickListId: list.id,
						tenantId: RequestContext.currentTenantId(),
						organizationId: RequestContext.currentOrganizationId()
					}
				}))
			);
		}

		return lines;
	}

	/**
	 * Cancels the lists of a wave that are still open.
	 *
	 * The wave owns this cascade (§18.3), and it is written here rather than by calling the list service,
	 * which would make the two services depend on each other. The lists themselves are the rows a picker
	 * reads, so the cancellation is recorded on them rather than left implied by the wave's status.
	 *
	 * @param waveId The wave.
	 * @param reason Why the lists were cancelled.
	 */
	private async cancelOpenLists(waveId: ID, reason: string): Promise<void> {
		const lists = await this.listsOfWave(waveId);

		for (const list of lists) {
			if ([PickListStatus.PICKED, PickListStatus.CANCELED].includes(list.status)) {
				continue;
			}

			await this.typeOrmPickListRepository.update(list.id, {
				status: PickListStatus.CANCELED,
				note: reason,
				version: (list.version ?? 1) + 1
			} as any);
		}
	}

	/**
	 * Allocates the next wave number from the platform numbering series.
	 *
	 * @returns The formatted number.
	 * @throws BadRequestException when the organization has no `PICK` series.
	 */
	private async allocateNumber(): Promise<string> {
		try {
			const allocated = await this.sequenceService.allocate(PICK_NUMBER_KEY);

			return allocated.formatted;
		} catch (error) {
			throw new BadRequestException(
				`No numbering series is configured for picking (key "${PICK_NUMBER_KEY}"), so a wave number cannot be allocated.`
			);
		}
	}
}
