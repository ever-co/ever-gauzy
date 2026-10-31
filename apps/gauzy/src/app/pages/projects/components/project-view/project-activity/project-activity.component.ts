import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	inject,
	Input,
	OnChanges,
	type SimpleChanges
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import { LocalDataSource } from 'angular2-smart-table';
import {
	ActionTypeEnum,
	BaseEntityEnum,
	IActivityLog,
	IComment,
	IPagination,
	ITask,
	ITaskStatus
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { CommentService } from '@gauzy/ui-core/core';
import { SmartDataViewLayoutModule } from '@gauzy/ui-core/shared';
import { parseCommentImages } from '../../../../shared/entity-comments/comment-images.util';
import {
	humanize,
	IPersonChip,
	Loadable,
	loaded,
	loading,
	failed,
	personOf,
	scopedTaskStatusesOf
} from '../project-view.utils';

/** One entry of the feed: who did what to which, and when. */
interface IActivityEntry {
	id: string;
	actor: IPersonChip | null;
	/** The actor's employee page; none for a user without an employee record. */
	actorLink: string[] | null;
	/** i18n key of the sentence's start: "{{ actor }} created", …; the target follows it. */
	sentence: string;
	target: string;
	/** The task the target opens in the project page's task drawer, or none for the project itself. */
	taskId: string | null;
	/** "title, status, members": the fields an update changed, the status aside when `status` names its move. */
	fields: string;
	/** A move to another status: the status before and after, by name and colour. */
	status: { from: IStatusSide; to: IStatusSide } | null;
	/** A comment's text, on one line, under the sentence; empty for the other entries. */
	excerpt: string;
	/** A comment of images only: "Image" stands in for its text. */
	imageOnly: boolean;
	/** A comment: the target opens the Comments tab. */
	isComment: boolean;
	time: string;
	timeLong: string;
	icon: string;
	tone: 'success' | 'info' | 'danger' | 'comment' | 'status';
}

/** One side of a status move: the status's name, and its colour when the status is known. */
interface IStatusSide {
	name: string;
	color?: string;
}

/** The feed's entries under their day: Today, Yesterday, then dates. */
interface IActivityDay {
	label: string;
	labelKey: string | null;
	entries: IActivityEntry[];
}

/** Entries the feed shows. */
const FEED_LIMIT = 60;
/** Entries per page of the feed at first, so a long feed reads page by page instead of scrolling. */
const FEED_PAGE_SIZE = 10;
/** The activity log's largest page. */
const LOG_PAGE_SIZE = 100;
/**
 * Pages of task logs read at most to fill the feed: the activity log filters by one entity id at a
 * time, so the project's task logs are found page by page among the organization's.
 */
const TASK_LOG_PAGES = 10;
/** Subtasks whose logs a task's feed reads, one request each. */
const SUBTASK_LOGS = 20;
/** The fields a status move writes: the status value, its row, and the row itself on a full update. */
const STATUS_FIELDS = new Set(['status', 'taskStatusId', 'taskStatus']);

/** A field's value among an update log's `{ field: value }` entries. */
function loggedValue(values: unknown, field: string): unknown {
	const entry = (Array.isArray(values) ? values : []).find(
		(item) => item && typeof item === 'object' && field in item
	);
	return entry?.[field];
}

/** A status as the feed names it: the status row's name, else its value ("in-progress" -> "In progress"). */
function statusNameOf(value: unknown, row?: unknown): string {
	const name = (row as { name?: string } | null)?.name;
	return name || (typeof value === 'string' ? humanize(value) : '');
}

/** "In Review" and "in-review" alike, to find a status by its value or name. */
const statusKeyOf = (value?: unknown): string =>
	typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '-') : '';

/**
 * The project page's Activity tab: a feed of what changed on the project and its tasks — created,
 * updated (and which fields), deleted — and of the comments posted on the project, by whom and when, newest
 * first, under each day. It reads the project's own log, the organization's task logs kept to the events that
 * happened in this project, and the project's newest comments (comments write no activity log of their own).
 *
 * Given a `taskId`, the feed is a task's: its own log, its subtasks' logs and its newest comments.
 */
@Component({
	selector: 'ga-project-activity',
	standalone: true,
	imports: [
		CommonModule,
		RouterModule,
		NbIconModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe,
		SmartDataViewLayoutModule
	],
	templateUrl: './project-activity.component.html',
	styleUrls: [
		'../../../../employees/view-employee/view-employee.component.scss',
		'../../project-quick-look/project-quick-look.component.scss',
		'./project-activity.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager
})
export class ProjectActivityComponent implements OnChanges {
	@Input() projectId: string;
	@Input() projectName: string;
	@Input() organizationId: string;
	@Input() tenantId: string;
	/** The task whose feed this is, in place of the project's. */
	@Input() taskId?: string;
	@Input() taskTitle?: string;
	/** The task's subtasks, whose changes the task's feed shows too. */
	@Input() subtasks: { id: string; title: string }[] = [];
	/** A task in the feed opens its own page, in place of the host's task drawer (`?task=`). */
	@Input() openTaskPage = false;
	/** Bumped by the host after a change it made (a status move, an edit): the feed reads again. */
	@Input() reloadKey = 0;

	public feed: Loadable<IActivityEntry[]> = loading([]);
	/** The current page's entries under their day. */
	public days: IActivityDay[] = [];
	/** The feed's entries, paged by the shared pager every list page uses. */
	public readonly source = new LocalDataSource();
	/** Some of the feed's reads failed: what is shown may be missing entries. */
	public partial = false;
	private readonly _http = inject(HttpClient);
	private readonly _comments = inject(CommentService);
	private _sequence = 0;
	/** The statuses the feed's tasks take, for the colours of their status moves. */
	private _statuses: ITaskStatus[] = [];

	constructor() {
		this.source.setPaging(1, FEED_PAGE_SIZE, false);
		// The pager pages the source: show the entries of whichever page it is on.
		this.source
			.onChanged()
			.pipe(takeUntilDestroyed(inject(DestroyRef)))
			.subscribe(async () => {
				const entries = (await this.source.getElements()) as IActivityEntry[];
				this.days = this.byDay(entries);
			});
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (
			(this.projectId || this.taskId) &&
			(changes['projectId'] || changes['taskId'] || changes['organizationId'] || changes['reloadKey'])
		) {
			void this.load();
		}
	}

	get count(): number {
		return (this.feed.value || []).length;
	}

	/** One page of the activity log for an entity, newest first, with who did it. */
	private logs(entity: BaseEntityEnum, extra: Record<string, unknown>): Promise<IPagination<IActivityLog>> {
		const { organizationId, tenantId } = this;
		return firstValueFrom(
			this._http.get<IPagination<IActivityLog>>(`${API_PREFIX}/activity-log`, {
				params: toParams({
					organizationId,
					tenantId,
					entity,
					orderBy: 'createdAt',
					order: 'DESC',
					relations: ['employee', 'employee.user'],
					...extra
				})
			})
		);
	}

	private async load(): Promise<void> {
		const sequence = ++this._sequence;
		const { organizationId, tenantId, projectId } = this;
		this.feed = loading([]);
		this.days = [];
		void this.source.load([]);
		this.partial = false;
		// The statuses the tasks take, as the board's columns, for the colours of the status moves; read beside the
		// feed, and a failed read leaves the moves uncoloured.
		this._statuses = [];
		const statuses = this.fetchStatuses().catch((): ITaskStatus[] => []);
		if (this.taskId) return this.loadTask(sequence, statuses);
		const logs = (entity: BaseEntityEnum, extra: Record<string, unknown>) => this.logs(entity, extra);

		// The project's tasks first (their titles, and the tasks a log that records no project belongs to), then the
		// project's own log and its task logs — each on its own.
		const [tasks] = await Promise.allSettled([
			firstValueFrom(
				this._http.get<IPagination<ITask>>(`${API_PREFIX}/tasks`, {
					params: toParams({ where: { organizationId, tenantId, projectId } })
				})
			)
		]);
		if (sequence !== this._sequence) return;
		const taskIds = new Set((tasks.status === 'fulfilled' ? tasks.value?.items || [] : []).map((task) => task.id));
		const [projectLogs, taskLogs, comments] = await Promise.allSettled([
			logs(BaseEntityEnum.OrganizationProject, { entityId: projectId, take: FEED_LIMIT }),
			this.fetchTaskLogs(logs, taskIds),
			this._comments.getLatest(
				BaseEntityEnum.OrganizationProject,
				projectId,
				{ organizationId, tenantId },
				FEED_LIMIT
			)
		]);
		this._statuses = await statuses;
		if (sequence !== this._sequence) return;

		if (projectLogs.status === 'rejected' && taskLogs.status === 'rejected' && comments.status === 'rejected') {
			this.feed = failed([]);
			return;
		}
		this.partial =
			projectLogs.status === 'rejected' ||
			taskLogs.status === 'rejected' ||
			comments.status === 'rejected' ||
			(taskLogs.status === 'fulfilled' && taskLogs.value.partial);

		const titles = new Map(
			(tasks.status === 'fulfilled' ? tasks.value?.items || [] : []).map((task) => [task.id, task.title])
		);
		const entries = [
			...(projectLogs.status === 'fulfilled' ? projectLogs.value?.items || [] : []).map((log) =>
				this.toEntry(log, this.projectName, null)
			),
			...(taskLogs.status === 'fulfilled' ? taskLogs.value.items : []).map((log) =>
				this.toEntry(log, titles.get(log.entityId) || (log.data as any)?.title || '', log.entityId)
			),
			...(comments.status === 'fulfilled' ? comments.value || [] : []).map((comment) =>
				this.toCommentEntry(comment)
			)
		]
			.sort((a, b) => b.time.localeCompare(a.time))
			.slice(0, FEED_LIMIT);
		this.show(entries);
	}

	/**
	 * A task's feed: its own log and each subtask's (the log filters by one entity id at a time), and the task's
	 * newest comments, each read on its own.
	 */
	private async loadTask(sequence: number, statuses: Promise<ITaskStatus[]>): Promise<void> {
		const { organizationId, tenantId, taskId } = this;
		const subtasks = (this.subtasks || []).slice(0, SUBTASK_LOGS);
		const ids = [taskId, ...subtasks.map((subtask) => subtask.id)];
		const [[comments], logs] = await Promise.all([
			Promise.allSettled([
				this._comments.getLatest(BaseEntityEnum.Task, taskId, { organizationId, tenantId }, FEED_LIMIT)
			]),
			Promise.allSettled(ids.map((entityId) => this.logs(BaseEntityEnum.Task, { entityId, take: FEED_LIMIT })))
		]);
		this._statuses = await statuses;
		if (sequence !== this._sequence) return;

		const results: PromiseSettledResult<unknown>[] = [comments, ...logs];
		if (results.every((result) => result.status === 'rejected')) {
			this.feed = failed([]);
			return;
		}
		this.partial = results.some((result) => result.status === 'rejected') || subtasks.length < this.subtasks.length;

		const titles = new Map<string, string>([
			[taskId, this.taskTitle],
			...subtasks.map((subtask): [string, string] => [subtask.id, subtask.title])
		]);
		const entries = [
			...logs.flatMap((result) => (result.status === 'fulfilled' ? result.value?.items || [] : [])).map((log) =>
				// The task's own entries name it without a link: it is the page they are on.
				this.toEntry(
					log,
					titles.get(log.entityId) || (log.data as any)?.title || '',
					log.entityId === taskId ? null : log.entityId
				)
			),
			...(comments.status === 'fulfilled' ? comments.value || [] : []).map((comment) =>
				this.toCommentEntry(comment)
			)
		]
			.sort((a, b) => b.time.localeCompare(a.time))
			.slice(0, FEED_LIMIT);
		this.show(entries);
	}

	/** Shows the feed from its first page. */
	private show(entries: IActivityEntry[]): void {
		this.feed = loaded(entries);
		this.source.setPaging(1, this.source.getPaging().perPage || FEED_PAGE_SIZE, false);
		void this.source.load(entries);
	}

	/**
	 * The project's task logs, newest first: the organization's task logs page by page, each kept
	 * when its event belongs to this project, until the feed is full or the pages run out. A page
	 * that fails after the first ends the read and marks it partial.
	 */
	private async fetchTaskLogs(
		logs: (entity: BaseEntityEnum, extra: Record<string, unknown>) => Promise<IPagination<IActivityLog>>,
		taskIds: ReadonlySet<string>
	): Promise<{ items: IActivityLog[]; partial: boolean }> {
		const items: IActivityLog[] = [];
		for (let page = 1; page <= TASK_LOG_PAGES && items.length < FEED_LIMIT; page++) {
			let result: IPagination<IActivityLog>;
			try {
				result = await logs(BaseEntityEnum.Task, { take: LOG_PAGE_SIZE, skip: page });
			} catch (error) {
				if (page === 1) throw error;
				return { items, partial: true };
			}
			const pageItems = result?.items || [];
			items.push(...pageItems.filter((log) => this.belongsToProject(log, taskIds)));
			if (pageItems.length < LOG_PAGE_SIZE) break;
			// The page budget ran out before the feed filled and more logs exist: the feed is a partial read,
			// not "no activity".
			if (page === TASK_LOG_PAGES && items.length < FEED_LIMIT && (result?.total ?? 0) > page * LOG_PAGE_SIZE) {
				return { items, partial: true };
			}
		}
		return { items, partial: false };
	}

	/**
	 * Whether a task's event happened in this project, by the project the event itself records — the
	 * task's project then (its snapshot), or either side of a move (its previous and updated values) —
	 * not by where the task is now. Only an event that records no project at all goes by the task's
	 * current project (one of `taskIds`).
	 */
	private belongsToProject(log: IActivityLog, taskIds: ReadonlySet<string>): boolean {
		const projectIds = new Set<string>();
		const add = (value: unknown) => {
			if (typeof value === 'string' && value) projectIds.add(value);
		};
		add((log.data as any)?.projectId);
		add((log.data as any)?.project?.id);
		for (const values of [log.previousValues, log.updatedValues, log.previousEntities, log.updatedEntities]) {
			for (const entry of (Array.isArray(values) ? values : []) as any[]) {
				add(entry?.projectId);
				add(entry?.project?.id);
			}
		}
		// A partial update that does not touch the project (only the estimate, say) records no project at all, and
		// neither do older logs: such an event belongs to the project its task is in now.
		if (projectIds.size === 0) return taskIds.has(log.entityId);
		return projectIds.has(this.projectId);
	}

	private toEntry(log: IActivityLog, target: string, taskId: string | null): IActivityEntry {
		const action = log.action;
		const sentences: Record<string, string> = {
			[ActionTypeEnum.Created]: 'PROJECT_VIEW.ACTIVITY_CREATED',
			[ActionTypeEnum.Updated]: 'PROJECT_VIEW.ACTIVITY_UPDATED',
			[ActionTypeEnum.Deleted]: 'PROJECT_VIEW.ACTIVITY_DELETED'
		};
		const icons: Record<string, string> = {
			[ActionTypeEnum.Created]: 'plus-circle-outline',
			[ActionTypeEnum.Updated]: 'edit-2-outline',
			[ActionTypeEnum.Deleted]: 'trash-2-outline'
		};
		const tones: Record<string, IActivityEntry['tone']> = {
			[ActionTypeEnum.Created]: 'success',
			[ActionTypeEnum.Updated]: 'info',
			[ActionTypeEnum.Deleted]: 'danger'
		};
		const time = moment(log.createdAt);
		const status = action === ActionTypeEnum.Updated ? this.statusMoveOf(log) : null;
		const fields = (log.updatedFields || []).filter((field) => !(status && STATUS_FIELDS.has(field)));
		return {
			id: log.id,
			actor: log.employee ? personOf(log.employee) : null,
			actorLink: log.employee?.id ? ['/pages/employees/view', log.employee.id] : null,
			sentence: status ? 'PROJECT_VIEW.ACTIVITY_STATUS_CHANGED' : sentences[action] || 'PROJECT_VIEW.ACTIVITY_UPDATED',
			target: target || '—',
			taskId: action === ActionTypeEnum.Deleted ? null : taskId,
			fields: fields.map((field) => humanize(field).toLowerCase()).join(', '),
			status,
			excerpt: '',
			imageOnly: false,
			isComment: false,
			time: time.toISOString(),
			timeLong: time.format('LLL'),
			icon: status ? 'swap-outline' : icons[action] || 'edit-2-outline',
			tone: status ? 'status' : tones[action] || 'info'
		};
	}

	/**
	 * The status an update moved a task from and to, from the values it logged; `null` for an update that left
	 * the status alone, or whose new status has no name.
	 */
	private statusMoveOf(log: IActivityLog): { from: IStatusSide; to: IStatusSide } | null {
		const changed = (log.updatedFields || []).some((field) => STATUS_FIELDS.has(field));
		if (!changed) return null;
		const from = this.statusSideOf(log.previousValues);
		const to = this.statusSideOf(log.updatedValues);
		if (!to.name || from.name === to.name) return null;
		return { from, to };
	}

	/**
	 * One side of a status move, from the values an update logged, by its status — the status row the update
	 * logged, else the one it names by id, else by its value or name. Its name is the logged row's, else the matched
	 * status's (an update may log only `taskStatusId`, or a `status` value that disagrees with it), else the value.
	 */
	private statusSideOf(values: unknown): IStatusSide {
		const value = loggedValue(values, 'status');
		const row = loggedValue(values, 'taskStatus') as Partial<ITaskStatus> | undefined;
		const id = (loggedValue(values, 'taskStatusId') as string) || row?.id;
		const keys = [statusKeyOf(value), statusKeyOf(row?.value), statusKeyOf(row?.name)].filter(Boolean);
		const status =
			(id && this._statuses.find((item) => item.id === id)) ||
			this._statuses.find((item) => keys.includes(statusKeyOf(item.value)) || keys.includes(statusKeyOf(item.name)));
		return {
			name: row?.name || statusNameOf(value, status),
			color: row?.color || status?.color || undefined
		};
	}

	/** The statuses the tasks take: the project's own, else the organization's, else the system defaults. */
	private async fetchStatuses(): Promise<ITaskStatus[]> {
		const { organizationId, tenantId, projectId } = this;
		const read = async (where: Record<string, string>) =>
			(
				await firstValueFrom(
					this._http.get<IPagination<ITaskStatus>>(`${API_PREFIX}/task-statuses`, { params: toParams(where) })
				)
			)?.items || [];
		return scopedTaskStatusesOf(read, { organizationId, tenantId, projectId });
	}

	/**
	 * A comment as an entry: "Ann commented on Project X" (or "replied on"), with its text on one line under it —
	 * "Image" for a comment of images only. Its author is the employee, or the user who posted it.
	 */
	private toCommentEntry(comment: IComment): IActivityEntry {
		const time = moment(comment.createdAt);
		const { text, images } = parseCommentImages(comment.comment);
		return {
			id: `comment-${comment.id}`,
			actor: personOf(comment.employee) ?? personOf(comment.createdByUser),
			actorLink: comment.employee?.id ? ['/pages/employees/view', comment.employee.id] : null,
			sentence: comment.parentId ? 'PROJECT_VIEW.ACTIVITY_REPLIED' : 'PROJECT_VIEW.ACTIVITY_COMMENTED',
			target: (this.taskId ? this.taskTitle : this.projectName) || '—',
			taskId: null,
			fields: '',
			status: null,
			excerpt: text.replace(/\s+/g, ' '),
			imageOnly: !text && images.length > 0,
			isComment: true,
			time: time.toISOString(),
			timeLong: time.format('LLL'),
			icon: 'message-square-outline',
			tone: 'comment'
		};
	}

	private byDay(entries: IActivityEntry[]): IActivityDay[] {
		const days = new Map<string, IActivityDay>();
		const today = moment().startOf('day');
		for (const entry of entries) {
			const day = moment(entry.time).startOf('day');
			const key = day.format('YYYY-MM-DD');
			if (!days.has(key)) {
				const diff = today.diff(day, 'days');
				days.set(key, {
					label: day.format('dddd, ll'),
					labelKey: diff === 0 ? 'PROJECT_VIEW.TODAY' : diff === 1 ? 'PROJECT_VIEW.YESTERDAY' : null,
					entries: []
				});
			}
			days.get(key).entries.push(entry);
		}
		return [...days.values()];
	}

	timeOf(entry: IActivityEntry): string {
		return moment(entry.time).format('LT');
	}
}
