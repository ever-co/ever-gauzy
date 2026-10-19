import { ChangeDetectionStrategy, Component, Input, OnChanges, type SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import { IPagination, ITask, ITaskStatus } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
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
	priority?: string;
	priorityLevel?: 'urgent' | 'high' | 'medium' | 'low';
	due: { key: string; count?: number } | null;
	overdue: boolean;
	soon: boolean;
	people: IPersonChip[];
	done: boolean;
}

/** One board column: a status, its colour, and its cards. */
interface IBoardColumn {
	id: string;
	name: string;
	color?: string;
	group: 'todo' | 'progress' | 'blocked' | 'done';
	cards: IBoardCard[];
}

const PRIORITY_LEVELS = new Set<string>(['urgent', 'high', 'medium', 'low']);

/**
 * The project page's Board tab: the project's tasks as a Kanban board, one column per status in the
 * tenant's own order and colours (the project's statuses, else the organization's), each card naming
 * its key, title, priority, due date and assignees, and opening the task's page.
 */
@Component({
	selector: 'ga-project-board',
	standalone: true,
	imports: [CommonModule, RouterModule, NbIconModule, NbSpinnerModule, NbTooltipModule, TranslatePipe],
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

	public board: Loadable<IBoardColumn[]> = loading([]);
	private _sequence = 0;

	constructor(private readonly _http: HttpClient) {}

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
		const done = isTaskFinished(task);
		const daysLeft = task.dueDate ? moment(task.dueDate).startOf('day').diff(today, 'days') : null;
		const priority = (task.taskPriority?.name || task.priority || '').toLowerCase();
		return {
			id: task.id,
			key: task.prefix && task.number ? `${task.prefix}-${task.number}` : '',
			title: task.title,
			priority: task.taskPriority?.name || humanize(task.priority) || undefined,
			priorityLevel: PRIORITY_LEVELS.has(priority) ? (priority as IBoardCard['priorityLevel']) : undefined,
			due: daysLeft === null ? null : dueInWords(daysLeft, done),
			overdue: !done && daysLeft !== null && daysLeft < 0,
			soon: !done && daysLeft !== null && daysLeft >= 0 && daysLeft <= 1,
			people: (task.members || []).map((member) => personOf(member)).filter(Boolean),
			done
		};
	}
}
