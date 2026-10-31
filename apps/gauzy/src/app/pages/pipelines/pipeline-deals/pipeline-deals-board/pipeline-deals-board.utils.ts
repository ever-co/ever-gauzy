import { ID, IDeal, IPipelineStage, IUser } from '@gauzy/contracts';
import {
	dealProbabilityBadge,
	IDealProbabilityBadge
} from '../../table-components/pipeline-deal-probability/deal-probability';

/** One deal as a board card. */
export interface IDealBoardCard {
	id: ID;
	title: string;
	/** The stage the card's column stands for; it changes once a move to another column is saved. */
	stageId: ID;
	probability: number | null;
	probabilityBadge: IDealProbabilityBadge;
	clientName?: string;
	createdByName?: string;
	createdByImageUrl?: string;
	/** True while a move to another column is being saved. */
	saving?: boolean;
}

/** One board column: a pipeline stage and the deals in it. */
export interface IDealBoardColumn {
	stageId: ID;
	name: string;
	description?: string;
	cards: IDealBoardCard[];
}

/** A user's name as the deals table shows its creator: the name, else first and last name, else the email. */
function userName(user?: IUser | null): string | undefined {
	if (!user) {
		return undefined;
	}
	const name = user.name || [user.firstName, user.lastName].filter(Boolean).join(' ');
	return name || user.email || undefined;
}

/** One deal as its board card. */
export function toDealBoardCard(deal: IDeal): IDealBoardCard {
	const probability = deal.probability ?? null;
	return {
		id: deal.id,
		title: deal.title,
		stageId: deal.stageId,
		probability,
		probabilityBadge: dealProbabilityBadge(probability),
		clientName: deal.client?.name || undefined,
		createdByName: userName(deal.createdByUser),
		createdByImageUrl: deal.createdByUser?.imageUrl || undefined
	};
}

/**
 * The board's columns: one per stage of the pipeline, in the stages' own order (`index`), each holding the
 * deals at that stage in the order they came. A deal whose stage is not one of the pipeline's (moved to
 * another pipeline since the page loaded) has no column and is left off the board.
 */
export function toDealBoardColumns(
	stages: IPipelineStage[] | null | undefined,
	deals: IDeal[] | null | undefined
): IDealBoardColumn[] {
	const ordered = [...(stages || [])].sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));
	const columns: IDealBoardColumn[] = ordered.map((stage) => ({
		stageId: stage.id,
		name: stage.name,
		description: stage.description || undefined,
		cards: []
	}));
	const byStage = new Map(columns.map((column) => [column.stageId, column]));
	for (const deal of deals || []) {
		byStage.get(deal.stageId)?.cards.push(toDealBoardCard(deal));
	}
	return columns;
}

/**
 * The board's moves the host has not yet brought its other views up to date with. A move is tracked from the
 * moment it starts, because leaving the board removes it (and its outputs) while a save can still be under
 * way: the host settles the moves when the board is left and reads the deals again once they are done.
 *
 * Until then the board is held back: a board shown again meanwhile would be built from deals read before the
 * moves, with a moved card back at its old stage and free to be dragged while its first save is still under
 * way, so an older save finishing last could overwrite a newer stage.
 */
export class DealBoardMoves {
	private _pending: Promise<boolean>[] = [];
	private _settling = 0;

	/** True while moves tracked before the board was left are settling, or the deals are being read again. */
	get held(): boolean {
		return this._settling > 0;
	}

	/** A move that started; `saved` settles with whether the deal was saved. */
	track(saved: Promise<boolean>): void {
		this._pending.push(saved);
	}

	/**
	 * Waits for every move tracked so far, forgets them and, if any was saved, reads the deals again through
	 * `reread`; the board is {@link held} until then. A move that failed put its card back, so it changed
	 * nothing to read again. Does nothing when no move was tracked.
	 *
	 * @param reread Reads the deals again, resolving once they are read.
	 */
	async settle(reread: () => Promise<void>): Promise<void> {
		if (!this._pending.length) {
			return;
		}
		const pending = this._pending;
		this._pending = [];
		this._settling++;
		try {
			const results = await Promise.all(pending);
			if (results.some(Boolean)) {
				await reread();
			}
		} finally {
			this._settling--;
		}
	}
}
