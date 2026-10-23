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
import { ActionTypeEnum, BaseEntityEnum, IActivityLog, IPagination, ITask } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { SmartDataViewLayoutModule } from '@gauzy/ui-core/shared';
import { humanize, IPersonChip, Loadable, loaded, loading, failed, personOf } from '../project-view.utils';

/** One entry of the feed: who did what to which, and when. */
interface IActivityEntry {
	id: string;
	actor: IPersonChip | null;
	/** i18n key of the sentence's start: "{{ actor }} created", …; the target follows it. */
	sentence: string;
	target: string;
	/** The task the target opens in the project page's task drawer, or none for the project itself. */
	taskId: string | null;
	/** "title, status, members": the fields an update changed. */
	fields: string;
	time: string;
	timeLong: string;
	icon: string;
	tone: 'success' | 'info' | 'danger';
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

/**
 * The project page's Activity tab: a feed of what changed on the project and its tasks — created,
 * updated (and which fields), deleted — by whom and when, newest first, under each day. It reads the
 * project's own log and the organization's task logs, kept to the events that happened in this project.
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

	public feed: Loadable<IActivityEntry[]> = loading([]);
	/** The current page's entries under their day. */
	public days: IActivityDay[] = [];
	/** The feed's entries, paged by the shared pager every list page uses. */
	public readonly source = new LocalDataSource();
	/** Some of the feed's reads failed: what is shown may be missing entries. */
	public partial = false;
	private readonly _http = inject(HttpClient);
	private _sequence = 0;

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
		if (this.projectId && (changes['projectId'] || changes['organizationId'])) {
			void this.load();
		}
	}

	get count(): number {
		return (this.feed.value || []).length;
	}

	private async load(): Promise<void> {
		const sequence = ++this._sequence;
		const { organizationId, tenantId, projectId } = this;
		this.feed = loading([]);
		this.days = [];
		void this.source.load([]);
		this.partial = false;
		const logs = (entity: BaseEntityEnum, extra: Record<string, unknown>) =>
			firstValueFrom(
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
		const [projectLogs, taskLogs] = await Promise.allSettled([
			logs(BaseEntityEnum.OrganizationProject, { entityId: projectId, take: FEED_LIMIT }),
			this.fetchTaskLogs(logs, taskIds)
		]);
		if (sequence !== this._sequence) return;

		if (projectLogs.status === 'rejected' && taskLogs.status === 'rejected') {
			this.feed = failed([]);
			return;
		}
		this.partial =
			projectLogs.status === 'rejected' ||
			taskLogs.status === 'rejected' ||
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
		return {
			id: log.id,
			actor: log.employee ? personOf(log.employee) : null,
			sentence: sentences[action] || 'PROJECT_VIEW.ACTIVITY_UPDATED',
			target: target || '—',
			taskId: action === ActionTypeEnum.Deleted ? null : taskId,
			fields: (log.updatedFields || []).map((field) => humanize(field).toLowerCase()).join(', '),
			time: time.toISOString(),
			timeLong: time.format('LLL'),
			icon: icons[action] || 'edit-2-outline',
			tone: tones[action] || 'info'
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
