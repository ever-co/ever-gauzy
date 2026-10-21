import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	Input,
	OnChanges,
	Output,
	type SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CdkDragDrop, CdkDragMove, DragDropModule, transferArrayItem } from '@angular/cdk/drag-drop';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import { IPagination, ITask, ITaskStatus, PermissionsEnum } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { isTaskFinished } from '../../../../tasks/components/task-view/task-view-sections';
import {
	dueInWords,
	humanize,
	IPersonChip,
	Loadable,
	loaded,
	loading,
	failed,
	personOf,
	statusGroupOf
} from '../project-view.utils';

/** One task as a board card. */
interface IBoardCard {
	id: string;
	key: string;
	title: string;
	/** Days until the due date (negative once past), or `null` without one. */
	daysLeft: number | null;
	priority?: string;
	priorityLevel?: 'urgent' | 'high' | 'medium' | 'low';
	due: { key: string; count?: number } | null;
	overdue: boolean;
	soon: boolean;
	people: IPersonChip[];
	done: boolean;
	/** True while a move to another column is being saved. */
	saving?: boolean;
}

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

/**
 * The project page's Board tab: the project's tasks as a Kanban board, one column per status in the
 * tenant's own order and colours (the project's statuses, else the organization's), each card naming
 * its key, title, priority, due date and assignees, and opening the task's page. A user who may edit
 * tasks drags a card to another column to change its status; a move that fails to save goes back.
 */
@Component({
	selector: 'ga-project-board',
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
	templateUrl: './project-board.component.html',
	styleUrls: [
		'../../../../employees/view-employee/view-employee.component.scss',
		'../../project-quick-look/project-quick-look.component.scss',
		'./project-board.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class ProjectBoardComponent implements OnChanges {
	@Input() projectId: string;
	@Input() organizationId: string;
	@Input() tenantId: string;
	/** A card's task saved with another status, so the host can bring what else shows the task up to date. */
	@Output() readonly taskMoved = new EventEmitter<string>();

	public board: Loadable<IBoardColumn[]> = loading([]);
	/** The column under a dragged card that will not take it, marked so the user sees it before letting go. */
	public refusingColumnId: string | null = null;
	private _sequence = 0;

	constructor(
		private readonly _http: HttpClient,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService
	) {}

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
		}
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (this.projectId && (changes['projectId'] || changes['organizationId'])) {
			void this.load();
		}
	}

	get total(): number {
		return (this.board.value || []).reduce((sum, column) => sum + column.cards.length, 0);
	}

	taskLink(id: string): string[] {
		return ['/pages/tasks/view', id];
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

	private async load(): Promise<void> {
		const sequence = ++this._sequence;
		const { organizationId, tenantId, projectId } = this;
		this.board = loading([]);
		try {
			const [statuses, tasks] = await Promise.all([
				this.fetchStatuses().catch((): ITaskStatus[] => []),
				firstValueFrom(
					this._http.get<IPagination<ITask>>(`${API_PREFIX}/tasks`, {
						params: toParams({
							where: { organizationId, tenantId, projectId },
							relations: ['taskStatus', 'taskPriority', 'members', 'members.user']
						})
					})
				)
			]);
			if (sequence !== this._sequence) return;
			this.board = loaded(this.toColumns(statuses, tasks?.items || []));
		} catch {
			if (sequence === this._sequence) this.board = failed([]);
		}
	}

	/**
	 * The project's own statuses, else the organization's, else the system defaults. A scope with no
	 * statuses of its own does not answer empty: the server answers with the system defaults, so each
	 * answer is kept only if its statuses belong to the scope asked for.
	 */
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
		const forProject = await read({ organizationId, tenantId, projectId });
		const own = forProject.filter((status) => !status.isSystem && status.projectId === projectId);
		if (own.length) return own;
		const forOrganization = await read({ organizationId, tenantId });
		const shared = forOrganization.filter(
			(status) => !status.isSystem && status.organizationId === organizationId && !status.projectId
		);
		if (shared.length) return shared;
		// Neither has its own: the system defaults either answer carried.
		return forOrganization.length ? forOrganization : forProject;
	}

	/**
	 * Columns in the statuses' order, then any status a task carries that is not in the list.
	 * A task finds its column by its status row, else by its status value or name.
	 */
	private toColumns(statuses: ITaskStatus[], tasks: ITask[]): IBoardColumn[] {
		const normalize = (value?: string) => (value || '').trim().toLowerCase().replace(/\s+/g, '-');
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
		const byId = new Map(ordered.map((status, index) => [status.id, columns[index]]));
		const byKey = new Map<string, IBoardColumn>();
		ordered.forEach((status, index) => {
			byKey.set(normalize(status.value), columns[index]);
			byKey.set(normalize(status.name), columns[index]);
		});

		const today = moment().startOf('day');
		for (const task of tasks) {
			let column =
				(task.taskStatusId && byId.get(task.taskStatusId)) ||
				byKey.get(normalize(task.status)) ||
				byKey.get(normalize(task.taskStatus?.name));
			if (!column) {
				const key = normalize(task.status) || 'no-status';
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
		// Each column: overdue cards first, the rest in the order the tasks came.
		for (const column of columns) {
			column.cards.sort((a, b) => Number(b.overdue) - Number(a.overdue));
		}
		return columns;
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
			done: false
		};
		this.setDone(card, isTaskFinished(task));
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
