import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NbButtonModule, NbIconModule, NbSelectModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import {
	BOARD_UNASSIGNED,
	boardAvatarColorOf,
	BoardFilterFacet,
	IBoardFilter,
	IBoardFilterOptions,
	isBoardFilterActive,
	NO_BOARD_FILTER,
	NO_BOARD_FILTER_OPTIONS
} from './board-filter';
import { SelectOptionsAtStartDirective } from './select-options-at-start.directive';

/**
 * The filters over a board, as Jira's: a search, the assignees as avatars to toggle, then a menu each for the
 * priorities, the types and the labels the cards carry. Presentational: the board owns the filter and applies it.
 * Whatever the host projects sits in the row, before the menus.
 */
@Component({
	selector: 'ga-board-filter-bar',
	standalone: true,
	imports: [NbButtonModule, NbIconModule, NbSelectModule, NbTooltipModule, SelectOptionsAtStartDirective, TranslatePipe],
	templateUrl: './board-filter-bar.component.html',
	styleUrls: ['./board-filter-bar.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardFilterBarComponent {
	protected readonly unassigned = BOARD_UNASSIGNED;
	protected readonly avatarColor = boardAvatarColorOf;
	protected readonly menus: { facet: Exclude<BoardFilterFacet, 'people'>; label: string }[] = [
		{ facet: 'priorities', label: 'PROJECT_VIEW.BOARD_FILTER.PRIORITY' },
		{ facet: 'types', label: 'PROJECT_VIEW.BOARD_FILTER.TYPE' },
		{ facet: 'labels', label: 'PROJECT_VIEW.BOARD_FILTER.LABELS' }
	];

	@Input() filter: IBoardFilter = NO_BOARD_FILTER;
	@Input() options: IBoardFilterOptions = NO_BOARD_FILTER_OPTIONS;
	/** The cards the filter leaves, "12+" with pages still to read. */
	@Input() shown = '0';
	/** The cards of the whole board. */
	@Input() total = 0;
	@Output() readonly filterChange = new EventEmitter<IBoardFilter>();

	protected get active(): boolean {
		return isBoardFilterActive(this.filter);
	}

	protected onSearch(search: string): void {
		this.filterChange.emit({ ...this.filter, search });
	}

	protected onSelect(facet: BoardFilterFacet, values: string[]): void {
		this.filterChange.emit({ ...this.filter, [facet]: values });
	}

	protected togglePerson(id: string): void {
		const { people } = this.filter;
		this.onSelect('people', people.includes(id) ? people.filter((person) => person !== id) : [...people, id]);
	}

	protected clear(): void {
		this.filterChange.emit(NO_BOARD_FILTER);
	}
}
