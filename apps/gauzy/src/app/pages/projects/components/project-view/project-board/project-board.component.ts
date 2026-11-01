import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	EventEmitter,
	Input,
	OnChanges,
	OnDestroy,
	Output,
	ViewChild,
	type SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CdkDragDrop, CdkDragMove, DragDropModule, transferArrayItem } from '@angular/cdk/drag-drop';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NbButtonModule, NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import { IPagination, ITask, ITasksStatistics, ITaskStatus, PermissionsEnum } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Store, TimesheetStatisticsService, ToastrService } from '@gauzy/ui-core/core';
import { isTaskFinished } from '../../../../tasks/components/task-view/task-view-sections';
import {
	dueInWords,
	humanize,
	IPersonChip,
	IProjectWorkedTime,
	ITaskProgress,
	Loadable,
	loaded,
	loading,
	failed,
	personOf,
	projectWorkedTimeOf,
	scopedTaskStatusesOf,
	statusGroupOf,
	taskProgressOf
} from '../project-view.utils';
import { BoardFilterBarComponent } from './board-filter-bar.component';
import { BoardMinimapComponent } from './board-minimap.component';
import {
	boardFilterOptionsOf,
	IBoardFilter,
	IBoardFilterCard,
	IBoardFilterOptions,
	isBoardFilterActive,
	matchesBoardFilter,
	NO_BOARD_FILTER,
	NO_BOARD_FILTER_OPTIONS
} from './board-filter';

/** One task as a board card. */
interface IBoardCard extends IBoardFilterCard {
	id: string;
	/** Days until the due date (negative once past), or `null` without one. */
	daysLeft: number | null;
	priorityLevel?: 'urgent' | 'high' | 'medium' | 'low';
	due: { key: string; count?: number } | null;
	overdue: boolean;
	soon: boolean;
	done: boolean;
	/** The task's estimate in seconds, or 0 without one. */
	estimate: number;
	/** Time worked against the estimate, or its share of the project's time without one; once read. */
	progress?: ITaskProgress | null;
	/** True while a move to another column is being saved. */
	saving?: boolean;
	/** The task whose subtasks the board shows: on the board too, as Jira's boards keep a parent with its subtasks. */
	isParent?: boolean;
}

const BOARD_RELATIONS = ['taskStatus', 'taskPriority', 'members', 'members.user'];

/** What only the filter reads: a card shows neither. */
const BOARD_FILTER_RELATIONS = ['taskType', 'tags'];

/** One board column: a status, its colour, and its cards. */
interface IBoardColumn {
	id: string;
	name: string;
	color?: string;
	group: 'todo' | 'progress' | 'blocked' | 'done';
	/** The status row behind the column; a column built from a task's bare status value has none and takes no drops. */
	statusId?: string;
	/** The status value a task moved here is saved with. */
	value?: string;
	cards: IBoardCard[];
}

const PRIORITY_LEVELS = new Set<string>(['urgent', 'high', 'medium', 'low']);

/** The tasks read at a time; the API takes at most 100. */
const BOARD_PAGE_SIZE = 50;

/** How near the end of the board the next page starts loading. */
const BOARD_END_MARGIN = '400px 0px';

/** A status value or name as columns are matched by it. */
const normalizeStatus = (value?: string): string => (value || '').trim().toLowerCase().replace(/\s+/g, '-');

/**
 * The project page's Board tab: the project's tasks as a Kanban board, one column per status in the
 * tenant's own order and colours (the project's statuses, else the organization's), each card naming
 * its key, title, priority, due date and assignees, and opening the task's page. A user who may edit
 * tasks drags a card to another column to change its status; a move that fails to save goes back.
 *
 * The tasks come a page at a time, the newest first, the next page as the board is scrolled near its end.
 * Pages run over the whole project rather than per column: a task's column can come from its status row or
 * from its bare status value, which one filter cannot ask for, and a card moved to another column leaves
 * the pages as they were.
 *
 * Given a `parentId`, the board is a task's: the task itself and its subtasks, in the columns of the task's
 * project, the task's card marked as the parent and first in its column.
 *
 * With `filterable`, filters over the columns narrow the cards. They work on the cards read so far, as the tasks
 * endpoint cannot ask for an assignee or a label: a narrowed board is short, which brings its end into reach, so
 * the remaining pages are read and filtered in turn, a whole project's included. What the host projects sits in the
 * filters' row.
 */
@Component({
	selector: 'ga-project-board',
	standalone: true,
	imports: [
		CommonModule,
		RouterModule,
		DragDropModule,
		BoardFilterBarComponent,
		BoardMinimapComponent,
		NbButtonModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe
	],
	templateUrl: './project-board.component.html',
	styleUrls: [
		'../../../../employees/view-employee/view-employee.component.scss',
		'../../project-quick-look/project-quick-look.component.scss',
		'./project-board.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectBoardComponent implements OnChanges, OnDestroy {
	@Input() projectId: string;
	@Input() organizationId: string;
	@Input() tenantId: string;
	/** The task whose subtasks the board shows, in place of the project's tasks. */
	@Input() parentId?: string;
	/** A card opens its task's own page, in place of the host's task drawer (`?task=`). */
	@Input() openTaskPage = false;
	/** What an empty board says. */
	@Input() emptyKey = 'PROJECT_QUICK_LOOK.NO_TASKS';
	/** Bumped by the host after a change it made elsewhere (its status menu, an edit): the board reads again. */
	@Input() reloadKey = 0;
	/** Shows the filters over the columns, and the map of the columns once they no longer fit. */
	@Input() filterable = false;
	/** A card's task saved with another status, so the host can bring what else shows the task up to date. */
	@Output() readonly taskMoved = new EventEmitter<string>();

	public board: Loadable<IBoardColumn[]> = loading([]);
	public filter: IBoardFilter = NO_BOARD_FILTER;
	/** What the cards read so far offer to filter by. */
	public filterOptions: IBoardFilterOptions = NO_BOARD_FILTER_OPTIONS;
	/** The column under a dragged card that will not take it, marked so the user sees it before letting go. */
	public refusingColumnId: string | null = null;
	/** The project's tasks, read or not: the subtasks, on a task's board. */
	public total = 0;
	/** A task's board shows the task itself, so it is not empty without subtasks. */
	public hasParent = false;
	/** The next page is on its way. */
	public loadingMore = false;
	/** The next page failed: the board's end offers to read it again, rather than asking again by itself. */
	public loadMoreFailed = false;
	private _sequence = 0;
	/** The tasks asked of the server so far, where the next page starts. */
	private _offset = 0;
	/** The tasks on the board: tasks created or deleted while paging bring rows already read into the next page. */
	private _placed = new Set<string>();
	/** The columns by status row and by status value or name, built with the columns and kept for the next pages. */
	private _columnsById = new Map<string, IBoardColumn>();
	private _columnsByKey = new Map<string, IBoardColumn>();
	/**
	 * Each task's time worked, once read; with a project, the cards of later pages take their bars from it.
	 * Without one, the time is read for the cards on the board, a page's at a time.
	 */
	private _worked: Map<string, number> | null = null;
	private _projectWorked?: IProjectWorkedTime;
	/** Settles when the drag under way ends, and is `null` without one. */
	private _dragEnd: Promise<void> | null = null;
	private _releaseDrag: (() => void) | null = null;
	private _endObserver: IntersectionObserver | null = null;
	private _end: HTMLElement | null = null;

	constructor(
		private readonly _http: HttpClient,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService,
		private readonly _statisticsService: TimesheetStatisticsService,
		private readonly _changeDetectorRef: ChangeDetectorRef
	) {}

	/** The end of the board, there while pages remain: the next page loads once it nears the view. */
	@ViewChild('boardEnd')
	set boardEnd(end: ElementRef<HTMLElement> | undefined) {
		this._endObserver?.disconnect();
		this._endObserver = null;
		this._end = end?.nativeElement ?? null;
		if (!this._end) return;
		this._endObserver = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) this.onEndReached();
			},
			// The page scrolls in an element of the layout, not the window: the scroll margin carries the distance
			// through it. A browser without one loads the next page when the end comes into view.
			{ rootMargin: BOARD_END_MARGIN, scrollMargin: BOARD_END_MARGIN }
		);
		this._endObserver.observe(this._end);
	}

	/** Pages remain to read. */
	get hasMore(): boolean {
		return this._offset < this.total;
	}

	/** The cards the filter leaves on the board, "12+" while pages remain to read. */
	get shownCards(): string {
		const shown = (this.board.value || []).reduce((sum, column) => sum + this.visibleCards(column).length, 0);
		return `${shown}${this.hasMore ? '+' : ''}`;
	}

	/** Every card of the board: `total` leaves out the parent's own. */
	get totalCards(): number {
		return this.total + Number(this.hasParent);
	}

	/** A column's cards the filter leaves. */
	visibleCards(column: IBoardColumn): IBoardCard[] {
		if (!isBoardFilterActive(this.filter)) return column.cards;
		return column.cards.filter((card) => matchesBoardFilter(card, this.filter));
	}

	/** Moving a card writes the task, so only a user who may edit tasks can drag. */
	get canMove(): boolean {
		return this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_EDIT);
	}

	/** Only a column backed by a status row takes a card: its status is what the move saves. */
	readonly acceptsDrop = (_drag: unknown, drop: { data: IBoardColumn }): boolean => !!drop.data?.statusId;

	/** While a card is dragged, marks the column under the pointer if it will not take the card. */
	onDragMoved(event: CdkDragMove<IBoardCard>): void {
		const column = this.columnAt(event.pointerPosition);
		const id = column && !column.statusId ? column.id : null;
		if (id !== this.refusingColumnId) this.refusingColumnId = id;
	}

	/** No page lands during a drag: the drop lists measured themselves when it began. */
	onDragStarted(): void {
		this._dragEnd = new Promise((resolve) => (this._releaseDrag = resolve));
	}

	onDragEnded(): void {
		this.endDrag();
		this.watchEnd();
	}

	/**
	 * A card dropped on another column: it moves at once and the task is saved with that column's
	 * status. If the save fails, the card goes back to where it was and an error says so.
	 */
	async drop(event: CdkDragDrop<IBoardColumn, IBoardColumn, IBoardCard>): Promise<void> {
		this.refusingColumnId = null;
		const from = event.previousContainer.data;
		const to = event.container.data;
		// Where the card was let go decides, not the last column that took it on the way: a card carried
		// through an open column and let go over one that refuses it stays put and says why.
		const released = this.columnAt(event.dropPoint);
		if (released && released !== from && !released.statusId) {
			this._toastrService.danger('PROJECT_VIEW.CANNOT_DROP', 'TOASTR.TITLE.ERROR', { column: released.name });
			return;
		}
		// Let go over its own column, outside the column that took it, or on one without a status: no move.
		if (from === to || !to.statusId || !event.isPointerOverContainer) return;
		// The dragged card itself, at the place it has now: a move that failed while this card was dragged
		// puts its card back and shifts the others, so the index the drag started at may name another card.
		let card = event.item.data;
		const index = card ? from.cards.indexOf(card) : -1;
		if (index < 0 || card.saving) return;

		transferArrayItem(from.cards, to.cards, index, event.currentIndex);
		const wasDone = card.done;
		this.setDone(card, to.group === 'done');
		card.saving = true;
		const sequence = this._sequence;
		try {
			// The status alone: a title or anything else read when the board loaded would undo a newer edit.
			await firstValueFrom(
				this._http.put<ITask>(`${API_PREFIX}/tasks/${card.id}/status`, {
					status: to.value,
					taskStatusId: to.statusId,
					organizationId: this.organizationId,
					tenantId: this.tenantId
				})
			);
			this.taskMoved.emit(card.id);
		} catch (error) {
			// A reload since the drop replaced the board: there is no card left to put back.
			if (sequence !== this._sequence) return;
			const current = to.cards.indexOf(card);
			if (current > -1) {
				transferArrayItem(to.cards, from.cards, current, Math.min(index, from.cards.length));
			}
			this.setDone(card, wasDone);
			this._toastrService.danger(error);
		} finally {
			card.saving = false;
			this._changeDetectorRef.markForCheck();
		}
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (
			(this.projectId || this.parentId) &&
			(changes['projectId'] || changes['parentId'] || changes['organizationId'] || changes['reloadKey'])
		) {
			void this.load();
		}
	}

	ngOnDestroy(): void {
		this._endObserver?.disconnect();
	}

	/** Reads the next page onto the board. */
	async loadMore(): Promise<void> {
		if (this.loadingMore || !this.hasMore) return;
		const sequence = this._sequence;
		this.loadingMore = true;
		this.loadMoreFailed = false;
		this._changeDetectorRef.markForCheck();
		try {
			const page = await this.fetchPage(this._offset);
			// A page asked for before the drag began waits for it to end.
			await this._dragEnd;
			if (sequence === this._sequence) {
				const placed = this.addPage(this.board.value, page);
				// Without a project, the time is read for the new cards on their own.
				if (!this.projectId && placed.length) {
					void this.loadProgress(
						sequence,
						placed.map((task) => task.id)
					);
				}
			}
		} catch {
			if (sequence === this._sequence) this.loadMoreFailed = true;
		} finally {
			// A reload since owns the flags, and the board.
			if (sequence === this._sequence) {
				this.loadingMore = false;
				this._changeDetectorRef.markForCheck();
				this.watchEnd();
			}
		}
	}

	peopleNames(people: IPersonChip[]): string {
		return (people || []).map((person) => person.name).join(', ');
	}

	/** The board column at a point on screen, if any. The drag preview takes no pointer events, so it is never the hit. */
	private columnAt(point: { x: number; y: number }): IBoardColumn | undefined {
		const element = point ? document.elementFromPoint(point.x, point.y) : null;
		const id = element?.closest<HTMLElement>('[data-column-id]')?.dataset['columnId'];
		return id ? (this.board.value || []).find((column) => column.id === id) : undefined;
	}

	private onEndReached(): void {
		if (!this.loadMoreFailed && !this._dragEnd) void this.loadMore();
	}

	private endDrag(): void {
		this._releaseDrag?.();
		this._releaseDrag = null;
		this._dragEnd = null;
	}

	/**
	 * Looks at the board's end anew. The observer speaks only when the end comes into reach, and a page too
	 * short to push it back out leaves it there: watched afresh, it reports where it now is.
	 */
	private watchEnd(): void {
		if (!this._end) return;
		this._endObserver?.unobserve(this._end);
		this._endObserver?.observe(this._end);
	}

	private async load(): Promise<void> {
		const sequence = ++this._sequence;
		// The board is replaced, and a dragged card with it: no end of that drag will be reported.
		this.endDrag();
		const { parentId } = this;
		this.board = loading([]);
		this.total = 0;
		this.loadingMore = false;
		this.loadMoreFailed = false;
		this._offset = 0;
		this._placed = new Set();
		this.hasParent = false;
		this._worked = null;
		this._projectWorked = undefined;
		try {
			const [statuses, page, parent] = await Promise.all([
				this.fetchStatuses().catch((): ITaskStatus[] => []),
				this.fetchPage(0),
				// The parent's own card; a failed read leaves the board with its subtasks only.
				parentId
					? firstValueFrom(
							this._http.get<ITask>(`${API_PREFIX}/tasks/${parentId}`, {
								params: toParams({ relations: this.relations })
							})
						).catch((): ITask | null => null)
					: Promise.resolve<ITask | null>(null)
			]);
			if (sequence !== this._sequence) return;
			const columns = this.toColumns(statuses);
			// The parent goes on before the pages, which read its subtasks only.
			if (parent?.id) {
				this.place(columns, [parent]);
				this._placed.add(parent.id);
				this.hasParent = true;
			}
			this.addPage(columns, page);
			this.board = loaded(columns);
			void this.loadProgress(sequence);
		} catch {
			if (sequence === this._sequence) this.board = failed([]);
		} finally {
			this._changeDetectorRef.markForCheck();
		}
	}

	private get relations(): string[] {
		return this.filterable ? [...BOARD_RELATIONS, ...BOARD_FILTER_RELATIONS] : BOARD_RELATIONS;
	}

	/**
	 * A page of the project's tasks, or of a task's subtasks given a `parentId`, from row `skip`. The id settles
	 * equal dates, so a row stays on one page.
	 */
	private fetchPage(skip: number): Promise<IPagination<ITask>> {
		const { organizationId, tenantId, projectId, parentId } = this;
		return firstValueFrom(
			this._http.get<IPagination<ITask>>(`${API_PREFIX}/tasks`, {
				params: toParams({
					where: { organizationId, tenantId, ...(parentId ? { parentId } : { projectId }) },
					relations: this.relations,
					order: { createdAt: 'DESC', id: 'ASC' },
					take: BOARD_PAGE_SIZE,
					skip
				})
			})
		);
	}

	/**
	 * Puts a page's tasks on the board. Tasks deleted since the last page moved the unread ones back by as many
	 * rows, so the next page starts that much earlier; what it reads again is already placed. An empty page with
	 * none deleted means the rest are gone: nothing more is asked. Returns the tasks it put on.
	 */
	private addPage(columns: IBoardColumn[], page: IPagination<ITask>): ITask[] {
		const items = page?.items || [];
		const total = page?.total || 0;
		const deleted = this.total - total;
		if (deleted > 0) this._offset = Math.max(0, this._offset - deleted);
		else this._offset = items.length ? this._offset + items.length : total;
		this.total = total;
		const fresh = items.filter((task) => !this._placed.has(task.id));
		this.place(columns, fresh);
		items.forEach((task) => this._placed.add(task.id));
		if (this.filterable) this.filterOptions = boardFilterOptionsOf(columns.flatMap((column) => column.cards));
		return fresh;
	}

	/**
	 * The time worked on each of the project's tasks, all time, against its estimate — or, without one,
	 * as its share of the project's time: the cards' progress bars. They come after the board, so a slow or
	 * failed read (most often a 403) never holds it up. Subtasks outside any project are read on their own,
	 * and without a project's time to share, only those with an estimate show a bar: the cards on the board, or
	 * the `ids` given (a page's new cards).
	 */
	private async loadProgress(sequence: number, ids?: string[]): Promise<void> {
		const { organizationId, tenantId, projectId } = this;
		const taskIds = ids || (this.board.value || []).flatMap((column) => column.cards.map((card) => card.id));
		if (!projectId && !taskIds.length) return;
		try {
			const rows = await this._statisticsService.getTasksStatistics({
				organizationId,
				tenantId,
				...(projectId ? { projectIds: [projectId] } : { taskIds })
			});
			if (sequence !== this._sequence) return;
			const worked = new Map((rows || []).map((row: ITasksStatistics) => [row.id, Number(row.duration) || 0]));
			if (projectId) {
				this._worked = worked;
				this._projectWorked = projectWorkedTimeOf([...worked.values()]);
			} else {
				// The rows leave out a task with no time worked: it is read all the same, at none.
				taskIds.forEach((id) => worked.has(id) || worked.set(id, 0));
				this._worked = new Map([...(this._worked || []), ...worked]);
			}
			for (const column of this.board.value || []) {
				column.cards.forEach((card) => this.setProgress(card));
			}
			this._changeDetectorRef.markForCheck();
		} catch {
			// The cards stay without bars.
		}
	}

	/** The project's own statuses, else the organization's, else the system defaults. */
	private async fetchStatuses(): Promise<ITaskStatus[]> {
		const { organizationId, tenantId, projectId } = this;
		const read = async (where: Record<string, string>) =>
			(
				await firstValueFrom(
					this._http.get<IPagination<ITaskStatus>>(`${API_PREFIX}/task-statuses`, {
						params: toParams(where)
					})
				)
			)?.items || [];
		return scopedTaskStatusesOf(read, { organizationId, tenantId, projectId });
	}

	/** The card's bar, once the time worked has been read: without a project, the time of its own task. */
	private setProgress(card: IBoardCard): void {
		if (!this._worked || (!this.projectId && !this._worked.has(card.id))) return;
		card.progress = taskProgressOf(this._worked.get(card.id) || 0, card.estimate, this._projectWorked);
	}

	/** The columns of the statuses, in their order, and the lookups a task finds its column by. */
	private toColumns(statuses: ITaskStatus[]): IBoardColumn[] {
		// One ordered list builds the columns and both lookups, so each status finds its own column.
		const ordered = [...statuses].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
		const columns: IBoardColumn[] = ordered.map((status) => ({
			id: status.id,
			name: status.name || humanize(status.value),
			color: status.color,
			group: status.isDone ? 'done' : statusGroupOf(status.value || status.name),
			statusId: status.id,
			value: status.value || status.name,
			cards: []
		}));
		this._columnsById = new Map(ordered.map((status, index) => [status.id, columns[index]]));
		this._columnsByKey = new Map<string, IBoardColumn>();
		ordered.forEach((status, index) => {
			this._columnsByKey.set(normalizeStatus(status.value), columns[index]);
			this._columnsByKey.set(normalizeStatus(status.name), columns[index]);
		});
		return columns;
	}

	/**
	 * Adds the tasks to their columns, opening one at the end for a status a task carries that is not in the
	 * list. A task finds its column by its status row, else by its status value or name.
	 */
	private place(columns: IBoardColumn[], tasks: ITask[]): void {
		const byId = this._columnsById;
		const byKey = this._columnsByKey;
		const today = moment().startOf('day');
		for (const task of tasks) {
			let column =
				(task.taskStatusId && byId.get(task.taskStatusId)) ||
				byKey.get(normalizeStatus(task.status)) ||
				byKey.get(normalizeStatus(task.taskStatus?.name));
			if (!column) {
				const key = normalizeStatus(task.status) || 'no-status';
				column = byKey.get(key);
				if (!column) {
					column = {
						id: key,
						name: humanize(task.status) || '—',
						color: task.taskStatus?.color,
						group: statusGroupOf(task.status),
						cards: []
					};
					columns.push(column);
					byKey.set(key, column);
				}
			}
			column.cards.push(this.toCard(task, today));
		}
		// Each column: the parent first, then overdue cards, the rest in the order the tasks came.
		for (const column of columns) {
			column.cards.sort(
				(a, b) => Number(!!b.isParent) - Number(!!a.isParent) || Number(b.overdue) - Number(a.overdue)
			);
		}
	}

	private toCard(task: ITask, today: moment.Moment): IBoardCard {
		const priority = (task.taskPriority?.name || task.priority || '').toLowerCase();
		let card: IBoardCard = {
			id: task.id,
			key: task.prefix && task.number ? `${task.prefix}-${task.number}` : '',
			title: task.title,
			daysLeft: task.dueDate ? moment(task.dueDate).startOf('day').diff(today, 'days') : null,
			priority: task.taskPriority?.name || humanize(task.priority) || undefined,
			priorityLevel: PRIORITY_LEVELS.has(priority) ? (priority as IBoardCard['priorityLevel']) : undefined,
			due: null,
			overdue: false,
			soon: false,
			people: (task.members || []).map((member) => personOf(member)).filter(Boolean),
			type: task.taskType?.name || humanize(task.issueType) || undefined,
			labels: (task.tags || []).map(({ id, name }) => ({ id, name })),
			done: false,
			estimate: Number(task.estimate) || 0,
			isParent: !!this.parentId && task.id === this.parentId
		};
		this.setDone(card, isTaskFinished(task));
		this.setProgress(card);
		return card;
	}

	/** Whether the card's task is finished, and the due-date state that follows from it. */
	private setDone(card: IBoardCard, done: boolean): void {
		const { daysLeft } = card;
		card.done = done;
		card.due = daysLeft === null ? null : dueInWords(daysLeft, done);
		card.overdue = !done && daysLeft !== null && daysLeft < 0;
		card.soon = !done && daysLeft !== null && daysLeft >= 0 && daysLeft <= 1;
	}
}
