import { FindOptionsWhere } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IOutboxWriteInput } from '@gauzy/contracts';
import { EventOutboxService } from '@gauzy/core';
import { PICK_LIST_AGGREGATE_TYPE } from '../warehouse.types';
import { IWarehouseTransaction } from '../warehouse-persistence';
import { landEdit } from '../warehouse.writable';
import { PickList } from './pick-list.entity';

/**
 * Runs one write in a transaction on the ORM the installation runs — a service's `runWarehouseTransaction`, bound to
 * its own repositories.
 */
export type TWarehouseTransactionRunner = <R>(work: (transaction: IWarehouseTransaction) => Promise<R>) => Promise<R>;

/**
 * One move of a pick list, and the fact it announces.
 */
export interface IPickListMove {
	/** The fact the move announces (`PICK_LIST_EVENTS`). */
	readonly name: string;
	/** The columns the move writes, the next version included. */
	readonly patch: Partial<PickList>;
	/** Writes that belong to the move — a cancellation's open lines — run in its transaction before the fact. */
	readonly alongside?: (transaction: IWarehouseTransaction) => Promise<void>;
	/**
	 * What a list that moved since it was read answers: `refuse` (the default) throws `PICK_LIST_EDIT_CONFLICT`;
	 * `skip` answers `false` and writes nothing, for a move that is a consequence of something the caller already
	 * did rather than the caller's own request (the start a first recorded pick implies).
	 */
	readonly whenMoved?: 'refuse' | 'skip';
}

/**
 * The outbox row a fact about a pick list is written as.
 *
 * The payload carries what a consumer routes on — the list, where the work is, the wave it belongs to, its status
 * and who owns it — and no line and no quantity: the list itself is one `pickList(id:)` away.
 *
 * @param name The fact.
 * @param list The list in the state the move left it.
 * @returns The outbox write.
 */
export function pickListFactOf(name: string, list: PickList): IOutboxWriteInput {
	return {
		name,
		aggregateType: PICK_LIST_AGGREGATE_TYPE,
		aggregateId: list.id,
		data: {
			pickListId: list.id,
			number: list.number ?? null,
			warehouseId: list.warehouseId ?? null,
			waveId: list.waveId ?? null,
			zoneId: list.zoneId ?? null,
			status: list.status,
			assignedToUserId: list.assignedToUserId ?? null,
			priority: list.priority ?? null,
			version: list.version ?? null
		},
		tenantId: list.tenantId,
		organizationId: list.organizationId
	};
}

/**
 * Moves a pick list and appends the fact the move announces, in one transaction — the one way any service of this
 * package moves a list's status, so every move is announced the same way: by the list's own operations, by the
 * first outcome recorded on one of its lines, and by its wave's cancellation.
 *
 * The status write is predicated on the status **and the version** the caller read — the version is the list's
 * optimistic-lock counter, which every transition takes and bumps — so a list that moved since it was read is never
 * moved twice and announced twice, and the fact's version is the version the statement stored. The writes that
 * belong to the move (`alongside`) run in the same transaction, and the fact is appended last: a write the
 * predicate refused throws (or, for `skip`, answers `false`) before anything else is written, and a write or an
 * append that fails rolls the whole move back. A subscriber, a webhook or a projection is told of every move that
 * committed — complete — and of nothing else.
 *
 * @param run The transaction runner of the calling service.
 * @param outbox The platform outbox.
 * @param list The list as the caller read it.
 * @param move The move.
 * @returns `true` when the list moved; `false` when it had moved since it was read and the move skips.
 * @throws ConflictException with `PICK_LIST_EDIT_CONFLICT` when the list moved since it was read and the move refuses.
 */
export async function movePickList(
	run: TWarehouseTransactionRunner,
	outbox: EventOutboxService,
	list: PickList,
	move: IPickListMove
): Promise<boolean> {
	return await run(async (transaction) => {
		const write = () =>
			transaction.rows(PickList).update(
				{
					id: list.id,
					status: list.status,
					...(list.version !== undefined && list.version !== null ? { version: list.version } : {}),
					...(list.tenantId ? { tenantId: list.tenantId } : {}),
					...(list.organizationId ? { organizationId: list.organizationId } : {})
				} as FindOptionsWhere<PickList>,
				move.patch as QueryDeepPartialEntity<PickList>
			);

		if (move.whenMoved === 'skip') {
			const { affected } = await write();

			if (!affected) {
				return false;
			}
		} else {
			await landEdit(write, 'PICK_LIST_EDIT_CONFLICT', 'pick list', list.id);
		}

		if (move.alongside) {
			await move.alongside(transaction);
		}

		await outbox.append(transaction.manager as never, pickListFactOf(move.name, { ...list, ...move.patch } as PickList));

		return true;
	});
}
