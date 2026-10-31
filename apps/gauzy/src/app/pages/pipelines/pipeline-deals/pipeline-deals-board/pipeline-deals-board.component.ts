import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	EventEmitter,
	Input,
	OnChanges,
	Output,
	type SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CdkDragDrop, DragDropModule, transferArrayItem } from '@angular/cdk/drag-drop';
import { NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { ID, IDeal, IPipelineStage, PermissionsEnum } from '@gauzy/contracts';
import { DealsService, ErrorHandlingService, Store } from '@gauzy/ui-core/core';
import { IDealBoardCard, IDealBoardColumn, toDealBoardColumns } from './pipeline-deals-board.utils';

/** A deal being saved at another stage from the board. */
export interface IDealStageMove {
	dealId: ID;
	stageId: ID;
	/** Settles once the save does, with whether the deal was saved. Never rejects. */
	saved: Promise<boolean>;
}

/**
 * A pipeline's deals as a board: one column per stage, in the stages' order, each card naming the deal,
 * its client, its probability and who created it. A user who may edit pipelines drags a card to another
 * column to move the deal to that stage; the card moves at once, shows a spinner while the deal is saved
 * through the deals update endpoint, and goes back with an error if the save fails.
 *
 * The board takes the deals the page has already read, so it is one more view of the same list, next to
 * the table and the cards grid.
 */
@Component({
	selector: 'ga-pipeline-deals-board',
	standalone: true,
	imports: [
		CommonModule,
		RouterModule,
		DragDropModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe
	],
	templateUrl: './pipeline-deals-board.component.html',
	// The tasks board's columns and cards, and the deals table's probability chip: one look for all of them.
	styleUrls: [
		'../../../projects/components/project-view/project-board/project-board.component.scss',
		'../../table-components/pipeline-deal-probability/pipeline-deal-probability.component.scss',
		'./pipeline-deals-board.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PipelineDealsBoardComponent implements OnChanges {
	/** The pipeline's stages: the board's columns. */
	@Input() stages: IPipelineStage[] = [];
	/** The pipeline's deals. */
	@Input() deals: IDeal[] = [];
	@Input() organizationId: ID;
	@Input() tenantId: ID;
	/**
	 * A deal is being saved at another stage, so the host can bring its other views up to date once `saved`
	 * settles. Emitted when the save starts, while the board is still there to emit it.
	 */
	@Output() readonly dealMoving = new EventEmitter<IDealStageMove>();

	public columns: IDealBoardColumn[] = [];
	/** Bumped whenever the columns are rebuilt: a save that settles afterwards has no card left to put back. */
	private _sequence = 0;

	constructor(
		private readonly _dealsService: DealsService,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _changeDetectorRef: ChangeDetectorRef
	) {}

	/** Moving a card edits the deal, so only a user who may edit pipelines can drag (as the page's Edit button). */
	get canMove(): boolean {
		return this._store.hasAnyPermission(PermissionsEnum.EDIT_SALES_PIPELINES);
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['stages'] || changes['deals']) {
			this._sequence++;
			this.columns = toDealBoardColumns(this.stages, this.deals);
		}
	}

	/**
	 * A card dropped on another column: it moves at once and the deal is saved at that column's stage.
	 * If the save fails, the card goes back to where it was and the error is shown.
	 */
	async drop(event: CdkDragDrop<IDealBoardColumn, IDealBoardColumn, IDealBoardCard>): Promise<void> {
		const from = event.previousContainer.data;
		const to = event.container.data;
		if (!this.canMove || !from || !to || from === to) {
			return;
		}
		// The dragged card itself, where it is now: a failed move that settled during this drag put its card
		// back and shifted the others, so the index the drag started at may name another card.
		const card = event.item.data;
		const index = card ? from.cards.indexOf(card) : -1;
		if (index < 0 || card.saving) {
			return;
		}

		transferArrayItem(from.cards, to.cards, index, event.currentIndex);
		card.saving = true;
		const sequence = this._sequence;
		const save = this._dealsService.updateStage(card.id, to.stageId, {
			organizationId: this.organizationId,
			tenantId: this.tenantId
		});
		this.dealMoving.emit({
			dealId: card.id,
			stageId: to.stageId,
			saved: save.then(
				() => true,
				() => false
			)
		});
		try {
			await save;
			card.stageId = to.stageId;
		} catch (error) {
			// The columns were rebuilt since the drop: the card is no longer on the board to put back.
			if (sequence === this._sequence) {
				const current = to.cards.indexOf(card);
				if (current > -1) {
					transferArrayItem(to.cards, from.cards, current, Math.min(index, from.cards.length));
				}
			}
			this._errorHandlingService.handleError(error);
		} finally {
			card.saving = false;
			this._changeDetectorRef.markForCheck();
		}
	}
}
