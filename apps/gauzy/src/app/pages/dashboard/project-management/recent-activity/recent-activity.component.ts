import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	Input,
	OnChanges,
	type SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NbButtonModule, NbIconModule, NbSelectModule, NbSpinnerModule, NbTooltipModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseEntityEnum, ID } from '@gauzy/contracts';
import { ActivityLogService } from '@gauzy/ui-core/core';
import {
	IRecentActivityItem,
	mergeRecentActivity,
	RECENT_ACTIVITY_I18N,
	RecentActivityFilter,
	toRecentActivityItem
} from './recent-activity.utils';

/**
 * The project management dashboard's Recent activity panel: what was created, changed or deleted in the
 * organization, newest first, a page at a time, each row naming the record, what was done, by whom and
 * when, and opening the task's or project's page. It can narrow to tasks or to projects.
 *
 * What a user sees is the activity log API's to decide: someone who may not change the selected employee
 * sees only their own activity.
 */
@Component({
	selector: 'ga-pm-recent-activity',
	standalone: true,
	imports: [
		CommonModule,
		RouterModule,
		NbButtonModule,
		NbIconModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		TranslatePipe
	],
	templateUrl: './recent-activity.component.html',
	// The dashboard's panels, lists and empty states, so this panel sits among them as one of theirs.
	styleUrls: [
		'../project-management-details/project-management-details.component.scss',
		'./recent-activity.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecentActivityComponent implements OnChanges {
	@Input() organizationId: ID | null;
	@Input() tenantId: ID | null;

	public readonly i18n = RECENT_ACTIVITY_I18N;
	public readonly entityFilters: { key: RecentActivityFilter; label: string }[] = [
		{ key: '', label: `${RECENT_ACTIVITY_I18N}.ALL` },
		{ key: BaseEntityEnum.Task, label: `${RECENT_ACTIVITY_I18N}.TASKS` },
		{ key: BaseEntityEnum.OrganizationProject, label: `${RECENT_ACTIVITY_I18N}.PROJECTS` }
	];
	public entityFilter: RecentActivityFilter = '';
	public items: IRecentActivityItem[] = [];
	public total = 0;
	public loading = false;
	public failed = false;
	private _page = 0;
	/** Bumped by every reload: a page asked for before it is dropped when it lands. */
	private _sequence = 0;

	constructor(
		private readonly _activityLogService: ActivityLogService,
		private readonly _changeDetectorRef: ChangeDetectorRef
	) {}

	/** More rows match than the panel holds. */
	get hasMore(): boolean {
		return this.items.length < this.total;
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['organizationId'] || changes['tenantId']) {
			void this.reload();
		}
	}

	/** Narrows the panel to one kind of record, or shows every kind again. */
	setEntityFilter(filter: RecentActivityFilter): void {
		if (filter !== this.entityFilter) {
			this.entityFilter = filter;
			void this.reload();
		}
	}

	/** Reads the activity again from its first page. */
	async reload(): Promise<void> {
		this._sequence++;
		this._page = 0;
		this.items = [];
		this.total = 0;
		this.failed = false;
		await this.loadMore();
	}

	/** Reads the next page onto the panel. */
	async loadMore(): Promise<void> {
		if (!this.organizationId) {
			this.loading = false;
			this._changeDetectorRef.markForCheck();
			return;
		}
		const sequence = this._sequence;
		const page = this._page + 1;
		this.loading = true;
		this.failed = false;
		this._changeDetectorRef.markForCheck();
		try {
			const { items, total } = await this._activityLogService.getPage({
				organizationId: this.organizationId,
				...(this.tenantId ? { tenantId: this.tenantId } : {}),
				...(this.entityFilter ? { entity: this.entityFilter } : {}),
				page
			});
			if (sequence !== this._sequence) {
				return;
			}
			const now = new Date();
			this.items = mergeRecentActivity(
				this.items,
				(items || []).map((log) => toRecentActivityItem(log, now))
			);
			// An empty page means the rest is gone (deleted since the count): nothing more to ask for.
			this.total = items?.length ? total || 0 : this.items.length;
			this._page = page;
		} catch {
			if (sequence === this._sequence) {
				this.failed = true;
			}
		} finally {
			if (sequence === this._sequence) {
				this.loading = false;
				this._changeDetectorRef.markForCheck();
			}
		}
	}
}
