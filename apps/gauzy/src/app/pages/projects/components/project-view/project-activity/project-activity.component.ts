import { ChangeDetectionStrategy, Component, inject, Input, OnChanges, type SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NbIconModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import * as moment from 'moment-timezone';
import { ActionTypeEnum, BaseEntityEnum, IActivityLog, IPagination, ITask } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { humanize, IPersonChip, Loadable, loaded, loading, failed, personOf } from '../project-view.utils';

/** One entry of the feed: who did what to which, and when. */
interface IActivityEntry {
	id: string;
	actor: IPersonChip | null;
	/** i18n key of the sentence's start: "{{ actor }} created", …; the target follows it. */
	sentence: string;
	target: string;
	/** Where the target leads: the task's page, or none for the project itself. */
	link: string[] | null;
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
/** Task logs read to find the project's among them: the activity log filters by one entity id at a time. */
const TASK_LOG_WINDOW = 300;

/**
 * The project page's Activity tab: a feed of what changed on the project and its tasks — created,
 * updated (and which fields), deleted — by whom and when, newest first, under each day. It reads the
 * project's own log and the latest task logs, kept to this project's tasks.
 */
@Component({
	selector: 'ga-project-activity',
	standalone: true,
	imports: [CommonModule, RouterModule, NbIconModule, NbSpinnerModule, NbTooltipModule, TranslatePipe],
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

	public feed: Loadable<IActivityDay[]> = loading([]);
	private readonly _http = inject(HttpClient);
	private _sequence = 0;

	ngOnChanges(changes: SimpleChanges): void {
		if (this.projectId && (changes['projectId'] || changes['organizationId'])) {
			void this.load();
		}
	}

	get count(): number {
		return (this.feed.value || []).reduce((sum, day) => sum + day.entries.length, 0);
	}

	private async load(): Promise<void> {
		const sequence = ++this._sequence;
		const { organizationId, tenantId, projectId } = this;
		this.feed = loading([]);
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
		try {
			const [tasks, projectLogs, taskLogs] = await Promise.all([
				firstValueFrom(
					this._http.get<IPagination<ITask>>(`${API_PREFIX}/tasks`, {
						params: toParams({ where: { organizationId, tenantId, projectId } })
					})
				).catch((): IPagination<ITask> => ({ items: [], total: 0 })),
				logs(BaseEntityEnum.OrganizationProject, { entityId: projectId, take: FEED_LIMIT }),
				logs(BaseEntityEnum.Task, { take: TASK_LOG_WINDOW }).catch((): IPagination<IActivityLog> => ({
					items: [],
					total: 0
				}))
			]);
			if (sequence !== this._sequence) return;
			const titles = new Map((tasks?.items || []).map((task) => [task.id, task.title]));
			const entries = [
				...(projectLogs?.items || []).map((log) => this.toEntry(log, this.projectName, null)),
				...(taskLogs?.items || [])
					.filter((log) => titles.has(log.entityId) || (log.data as any)?.projectId === projectId)
					.map((log) =>
						this.toEntry(log, titles.get(log.entityId) || (log.data as any)?.title || '', [
							'/pages/tasks/view',
							log.entityId
						])
					)
			]
				.sort((a, b) => b.time.localeCompare(a.time))
				.slice(0, FEED_LIMIT);
			this.feed = loaded(this.byDay(entries));
		} catch {
			if (sequence === this._sequence) this.feed = failed([]);
		}
	}

	private toEntry(log: IActivityLog, target: string, link: string[] | null): IActivityEntry {
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
			link: action === ActionTypeEnum.Deleted ? null : link,
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
