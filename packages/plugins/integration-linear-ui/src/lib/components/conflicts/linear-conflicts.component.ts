import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	DestroyRef,
	EventEmitter,
	inject,
	Input,
	OnChanges,
	Output,
	SimpleChanges
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbSelectModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { from, map, mergeMap, Subscription } from 'rxjs';
import { LinearConflict, LinearConflictKeep, LinearConflictStatus, LinearUiService } from '../../services/linear-ui.service';
import { conflictValueView, ConflictValueView, errorCode, errorText, isNotFound } from '../shared/linear-ui.utils';

/** The platform's page of a task (`/pages/tasks/view/:id`): a conflict's task opens there. */
export const TASK_VIEW_LINK = '/pages/tasks/view';

/** How many task titles are read at once. */
const TITLE_CONCURRENCY = 4;

/** The translated message of the API's conflict refusals; anything else shows the API's own message. */
const ERROR_KEYS: Record<string, string> = {
	LINEAR_CONFLICT_STALE: 'LINEAR.CONFLICTS.ERRORS.STALE',
	LINEAR_CONFLICT_NOT_FOUND: 'LINEAR.CONFLICTS.ERRORS.NOT_FOUND'
};

/** A conflict with its two values ready to show. */
export interface LinearConflictRow {
	conflict: LinearConflict;
	platform: ConflictValueView;
	external: ConflictValueView;
}

export function conflictRowOf(conflict: LinearConflict): LinearConflictRow {
	return {
		conflict,
		platform: conflictValueView(conflict.field, conflict.platformValue),
		external: conflictValueView(conflict.field, conflict.externalValue)
	};
}

/**
 * The sync conflicts of a Linear connection: fields changed both in Linear and on the platform to different values
 * since they last agreed. Linear's value was applied to the task and the task's is kept; a manager keeps Linear's
 * value, or writes the task's back (`POST …/conflicts/:id/resolve`, `keep: external | platform`). Open ones by
 * default, resolved ones on request; `runId` narrows the list to what one run found (the sync log opens it so).
 */
@Component({
	selector: 'ngx-linear-conflicts',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, RouterLink, NbAlertModule, NbButtonModule, NbSelectModule, TranslatePipe],
	template: `
		<h5>
			{{ 'LINEAR.CONFLICTS.TITLE' | translate }}
			<button nbButton ghost size="tiny" type="button" data-test="refresh-conflicts" [disabled]="loading" (click)="load()">
				{{ 'LINEAR.COMMON.REFRESH' | translate }}
			</button>
		</h5>
		<p class="intro">{{ 'LINEAR.CONFLICTS.INTRO' | translate }}</p>
		<div class="filters">
			<nb-select size="small" [selected]="status" [disabled]="loading" data-test="conflict-status" (selectedChange)="changeStatus($event)">
				@for (item of statuses; track item) {
					<nb-option [value]="item">{{ 'LINEAR.CONFLICTS.STATUSES.' + item | translate }}</nb-option>
				}
			</nb-select>
			@if (runId) {
				<span class="run-filter" data-test="run-filter">
					{{ 'LINEAR.CONFLICTS.RUN_FILTER' | translate }}
					<button nbButton ghost size="tiny" type="button" data-test="clear-run" (click)="clearRun()">{{ 'LINEAR.CONFLICTS.SHOW_ALL' | translate }}</button>
				</span>
			}
		</div>
		@if (error) {
			<nb-alert status="danger" role="alert" data-test="conflicts-error">{{ error }}</nb-alert>
		}
		@if (notice) {
			<nb-alert status="success" data-test="conflicts-notice">{{ notice }}</nb-alert>
		}
		@if (loading && !rows.length) {
			<p data-test="conflicts-loading">{{ 'LINEAR.LOADING' | translate }}</p>
		} @else if (!rows.length) {
			<p data-test="no-conflicts">{{ (status === 'open' ? 'LINEAR.CONFLICTS.EMPTY' : 'LINEAR.CONFLICTS.EMPTY_RESOLVED') | translate }}</p>
		} @else {
			<table class="table" data-test="conflict-list">
				<thead>
					<tr>
						<th>{{ 'LINEAR.CONFLICTS.TASK' | translate }}</th>
						<th>{{ 'LINEAR.CONFLICTS.FIELD' | translate }}</th>
						<th>{{ 'LINEAR.CONFLICTS.PLATFORM_VALUE' | translate }}</th>
						<th>{{ 'LINEAR.CONFLICTS.EXTERNAL_VALUE' | translate }}</th>
						<th>{{ 'LINEAR.CONFLICTS.FOUND' | translate }}</th>
						<th>{{ (status === 'open' ? 'LINEAR.CONFLICTS.RESOLVE' : 'LINEAR.CONFLICTS.RESOLUTION') | translate }}</th>
					</tr>
				</thead>
				<tbody>
					@for (row of rows; track row.conflict.id) {
						<tr [attr.data-test]="'conflict-' + row.conflict.id">
							<td>
								<a [routerLink]="[taskLink, row.conflict.taskId]" data-test="task">{{ titleOf(row.conflict.taskId) || ('LINEAR.CONFLICTS.OPEN_TASK' | translate) }}</a>
								<small class="note">{{ 'LINEAR.CONFLICTS.ITEM' | translate: { id: row.conflict.sourceId } }}</small>
							</td>
							<td data-test="field">{{ 'LINEAR.CONFLICTS.FIELDS.' + row.conflict.field | translate }}</td>
							<td class="value" data-test="platform-value" [attr.title]="row.platform.full || null">
								@if (row.platform.empty) {
									<em class="note">{{ 'LINEAR.CONFLICTS.EMPTY_VALUE' | translate }}</em>
								} @else if (row.platform.date) {
									{{ row.platform.date | date: 'medium' }}
								} @else {
									{{ row.platform.text }}
								}
							</td>
							<td class="value" data-test="external-value" [attr.title]="row.external.full || null">
								@if (row.external.empty) {
									<em class="note">{{ 'LINEAR.CONFLICTS.EMPTY_VALUE' | translate }}</em>
								} @else if (row.external.date) {
									{{ row.external.date | date: 'medium' }}
								} @else {
									{{ row.external.text }}
								}
							</td>
							<td>{{ row.conflict.createdAt ? (row.conflict.createdAt | date: 'short') : '—' }}</td>
							@if (row.conflict.status === 'open') {
								<td class="actions">
									<button
										nbButton
										size="tiny"
										status="primary"
										type="button"
										[attr.data-test]="'keep-external-' + row.conflict.id"
										[disabled]="!!resolving"
										(click)="resolve(row, 'external')"
									>
										{{ 'LINEAR.CONFLICTS.KEEP_EXTERNAL' | translate }}
									</button>
									<button
										nbButton
										size="tiny"
										ghost
										type="button"
										[attr.data-test]="'keep-platform-' + row.conflict.id"
										[disabled]="!!resolving"
										(click)="resolve(row, 'platform')"
									>
										{{ 'LINEAR.CONFLICTS.KEEP_PLATFORM' | translate }}
									</button>
								</td>
							} @else {
								<td data-test="resolution">
									{{ row.conflict.resolution ? ('LINEAR.CONFLICTS.RESOLUTIONS.' + row.conflict.resolution | translate) : '—' }}
									@if (row.conflict.resolvedAt) {
										<small class="note">{{ row.conflict.resolvedAt | date: 'short' }}</small>
									}
								</td>
							}
						</tr>
					}
				</tbody>
			</table>
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.intro,
			.note {
				opacity: 0.8;
				display: block;
			}
			.filters {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.75rem;
				margin: 0.75rem 0;
			}
			.run-filter {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
			}
			.value {
				max-width: 20rem;
				overflow-wrap: anywhere;
			}
			.actions {
				white-space: nowrap;
			}
			.actions button {
				margin-right: 0.25rem;
			}
		`
	]
})
export class LinearConflictsComponent implements OnChanges {
	private readonly api = inject(LinearUiService);
	private readonly translate = inject(TranslateService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	/** The connection. */
	@Input({ required: true }) integrationId!: string;
	/** Only what this run found; null: every run. */
	@Input() runId: string | null = null;
	/** The run filter was cleared ("Show all"): `[(runId)]` follows. */
	@Output() readonly runIdChange = new EventEmitter<string | null>();

	readonly statuses: LinearConflictStatus[] = ['open', 'resolved'];
	readonly taskLink = TASK_VIEW_LINK;

	status: LinearConflictStatus = 'open';
	rows: LinearConflictRow[] = [];
	loading = false;
	/** The conflict being resolved (one at a time). */
	resolving: string | null = null;
	error: string | null = null;
	notice: string | null = null;

	/** Task titles by id, each read once (null: not readable, the link says "Open the task"). */
	private readonly titles = new Map<string, string | null>();
	private listing: Subscription | null = null;

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['integrationId'] || changes['runId']) this.load();
	}

	/** Reads the list again (the filters as they are). `keepMessages`: the line a resolve just wrote stays. */
	load(keepMessages = false): void {
		if (!this.integrationId) return;
		this.listing?.unsubscribe();
		this.loading = true;
		if (!keepMessages) {
			this.error = null;
			this.notice = null;
		}
		this.cdr.markForCheck();
		this.listing = this.api
			.conflicts(this.integrationId, { status: this.status, runId: this.runId })
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (conflicts) => {
					this.rows = conflicts.map(conflictRowOf);
					this.loading = false;
					this.readTitles(conflicts);
					this.cdr.markForCheck();
				},
				error: (error) => {
					this.rows = [];
					this.loading = false;
					this.error = errorText(error);
					this.cdr.markForCheck();
				}
			});
	}

	changeStatus(status: LinearConflictStatus): void {
		if (status === this.status) return;
		this.status = status;
		this.rows = [];
		this.load();
	}

	clearRun(): void {
		this.runIdChange.emit(null);
	}

	titleOf(taskId: string): string | null {
		return this.titles.get(taskId) ?? null;
	}

	/**
	 * Keeps Linear's value (`external`) or writes the task's back (`platform`). Refused when the task changed since
	 * (409: the list says why and keeps the conflict) or when it is resolved already (404: the list is read again).
	 */
	resolve(row: LinearConflictRow, keep: LinearConflictKeep): void {
		if (!this.integrationId || this.resolving) return;
		const id = row.conflict.id;
		this.resolving = id;
		this.error = null;
		this.notice = null;
		this.cdr.markForCheck();
		this.api
			.resolveConflict(this.integrationId, id, keep)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: () => {
					this.resolving = null;
					this.rows = this.rows.filter((item) => item.conflict.id !== id);
					this.notice = this.translate.instant(keep === 'platform' ? 'LINEAR.CONFLICTS.KEPT_PLATFORM' : 'LINEAR.CONFLICTS.KEPT_EXTERNAL');
					this.cdr.markForCheck();
				},
				error: (error) => {
					this.resolving = null;
					const key = ERROR_KEYS[errorCode(error) ?? ''];
					this.error = key ? this.translate.instant(key) : errorText(error);
					this.cdr.markForCheck();
					if (isNotFound(error)) this.load(true);
				}
			});
	}

	/** The titles of the tasks not read yet, a few at a time. */
	private readTitles(conflicts: readonly LinearConflict[]): void {
		const missing = [...new Set(conflicts.map((conflict) => conflict.taskId))].filter((taskId) => taskId && !this.titles.has(taskId));
		if (!missing.length) return;
		for (const taskId of missing) this.titles.set(taskId, null);
		from(missing)
			.pipe(
				mergeMap((taskId) => this.api.taskTitle(taskId).pipe(map((title) => [taskId, title] as const)), TITLE_CONCURRENCY),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(([taskId, title]) => {
				this.titles.set(taskId, title);
				this.cdr.markForCheck();
			});
	}
}
