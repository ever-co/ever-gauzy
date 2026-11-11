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
	type SimpleChanges
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbSelectModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { TrelloConflict, TrelloConflictKeep, TrelloConflictStatus, TrelloUiService, TASK_TITLES_MAX } from '../../services/trello-ui.service';
import { conflictValueView, ConflictValueView, errorCode, errorText, isNotFound } from '../shared/trello-ui.utils';

/** The platform's page of a task (`/pages/tasks/view/:id`): a conflict's task opens there. */
export const TASK_VIEW_LINK = '/pages/tasks/view';

/** How many conflicts a read asks for, and how many more "Show more" adds, up to the route's limit. */
export const CONFLICTS_PAGE = 50;
export const CONFLICTS_MAX = 200;

/** The translated message of the API's conflict refusals; anything else shows the API's own message. */
const ERROR_KEYS: Record<string, string> = {
	TRELLO_CONFLICT_STALE: 'TRELLO.CONFLICTS.ERRORS.STALE',
	TRELLO_CONFLICT_NOT_FOUND: 'TRELLO.CONFLICTS.ERRORS.NOT_FOUND'
};

/** A conflict with its two values ready to show. */
export interface TrelloConflictRow {
	conflict: TrelloConflict;
	platform: ConflictValueView;
	external: ConflictValueView;
}

export function conflictRowOf(conflict: TrelloConflict): TrelloConflictRow {
	return {
		conflict,
		platform: conflictValueView(conflict.field, conflict.platformValue),
		external: conflictValueView(conflict.field, conflict.externalValue)
	};
}

/** Which side of a conflict a value cell shows. */
export type ConflictSide = 'platform' | 'external';

/**
 * The sync conflicts of a Trello connection: fields changed both in Trello and on the platform to different values
 * since they last agreed. Trello's value was applied to the task and the task's is kept; a manager keeps Trello's
 * value, or writes the task's back (`POST …/conflicts/:id/resolve`, `keep: external | platform`). Open ones by
 * default, resolved ones on request; `runId` narrows the list to what one run found (the sync log opens it so). The
 * newest {@link CONFLICTS_PAGE} are read, "Show more" reads more up to the route's limit, and the list is read again
 * after each resolve, so the older ones come up as the newer ones are resolved.
 */
@Component({
	selector: 'ngx-trello-conflicts',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, RouterLink, NbAlertModule, NbButtonModule, NbSelectModule, TranslatePipe],
	template: `
		<h5>
			{{ 'TRELLO.CONFLICTS.TITLE' | translate }}
			<button nbButton ghost size="tiny" type="button" data-test="refresh-conflicts" [disabled]="loading || !!resolving" (click)="load()">
				{{ 'TRELLO.COMMON.REFRESH' | translate }}
			</button>
		</h5>
		<p class="intro">{{ 'TRELLO.CONFLICTS.INTRO' | translate }}</p>
		<div class="filters">
			<nb-select size="small" [selected]="status" [disabled]="loading" data-test="conflict-status" (selectedChange)="changeStatus($event)">
				@for (item of statuses; track item) {
					<nb-option [value]="item">{{ 'TRELLO.CONFLICTS.STATUSES.' + item | translate }}</nb-option>
				}
			</nb-select>
			@if (runId) {
				<span class="run-filter" data-test="run-filter">
					{{ 'TRELLO.CONFLICTS.RUN_FILTER' | translate }}
					<button nbButton ghost size="tiny" type="button" data-test="clear-run" (click)="clearRun()">{{ 'TRELLO.CONFLICTS.SHOW_ALL' | translate }}</button>
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
			<p data-test="conflicts-loading">{{ 'TRELLO.LOADING' | translate }}</p>
		} @else if (!rows.length) {
			<p data-test="no-conflicts">{{ (status === 'open' ? 'TRELLO.CONFLICTS.EMPTY' : 'TRELLO.CONFLICTS.EMPTY_RESOLVED') | translate }}</p>
		} @else {
			<table class="table" data-test="conflict-list">
				<thead>
					<tr>
						<th>{{ 'TRELLO.CONFLICTS.TASK' | translate }}</th>
						<th>{{ 'TRELLO.CONFLICTS.FIELD' | translate }}</th>
						<th>{{ 'TRELLO.CONFLICTS.PLATFORM_VALUE' | translate }}</th>
						<th>{{ 'TRELLO.CONFLICTS.EXTERNAL_VALUE' | translate }}</th>
						<th>{{ 'TRELLO.CONFLICTS.FOUND' | translate }}</th>
						<th>{{ (status === 'open' ? 'TRELLO.CONFLICTS.RESOLVE' : 'TRELLO.CONFLICTS.RESOLUTION') | translate }}</th>
					</tr>
				</thead>
				<tbody>
					@for (row of rows; track row.conflict.id) {
						<tr [attr.data-test]="'conflict-' + row.conflict.id">
							<td>
								<a [routerLink]="[taskLink, row.conflict.taskId]" data-test="task">{{ titleOf(row.conflict.taskId) || ('TRELLO.CONFLICTS.OPEN_TASK' | translate) }}</a>
								<small class="note">{{ 'TRELLO.CONFLICTS.ITEM' | translate: { id: row.conflict.sourceId } }}</small>
							</td>
							<td data-test="field">{{ 'TRELLO.CONFLICTS.FIELDS.' + row.conflict.field | translate }}</td>
							@for (side of sides; track side) {
								@let view = side === 'platform' ? row.platform : row.external;
								<td class="value" [attr.data-test]="side + '-value'" [attr.title]="view.full || null">
									@if (view.empty) {
										<em class="note">{{ 'TRELLO.CONFLICTS.EMPTY_VALUE' | translate }}</em>
									} @else if (view.date && view.dateOnly) {
										{{ view.date | date: 'mediumDate' }}
									} @else if (view.date) {
										{{ view.date | date: 'medium' }}
									} @else {
										<span class="text">{{ isExpanded(row, side) ? view.full : view.text }}</span>
										@if (view.full !== view.text) {
											<button
												nbButton
												ghost
												size="tiny"
												type="button"
												class="more"
												[attr.data-test]="side + '-toggle'"
												[attr.aria-expanded]="isExpanded(row, side)"
												(click)="toggle(row, side)"
											>
												{{ (isExpanded(row, side) ? 'TRELLO.CONFLICTS.SHOW_LESS' : 'TRELLO.CONFLICTS.SHOW_FULL') | translate }}
											</button>
										}
									}
								</td>
							}
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
										{{ 'TRELLO.CONFLICTS.KEEP_EXTERNAL' | translate }}
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
										{{ 'TRELLO.CONFLICTS.KEEP_PLATFORM' | translate }}
									</button>
								</td>
							} @else {
								<td data-test="resolution">
									{{ row.conflict.resolution ? ('TRELLO.CONFLICTS.RESOLUTIONS.' + row.conflict.resolution | translate) : '—' }}
									@if (row.conflict.resolvedAt) {
										<small class="note">{{ row.conflict.resolvedAt | date: 'short' }}</small>
									}
								</td>
							}
						</tr>
					}
				</tbody>
			</table>
			@if (canShowMore) {
				<button nbButton ghost size="small" type="button" data-test="more-conflicts" [disabled]="loading || !!resolving" (click)="showMore()">
					{{ 'TRELLO.CONFLICTS.SHOW_MORE' | translate }}
				</button>
			}
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
			.value .text {
				white-space: pre-wrap;
			}
			.value .more {
				display: block;
				padding-left: 0;
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
export class TrelloConflictsComponent implements OnChanges {
	private readonly api = inject(TrelloUiService);
	private readonly translate = inject(TranslateService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	/** The connection. */
	@Input({ required: true }) integrationId!: string;
	/** Only what this run found; null: every run. */
	@Input() runId: string | null = null;
	/** The run filter was cleared ("Show all"): `[(runId)]` follows. */
	@Output() readonly runIdChange = new EventEmitter<string | null>();

	readonly statuses: TrelloConflictStatus[] = ['open', 'resolved'];
	readonly sides: ConflictSide[] = ['platform', 'external'];
	readonly taskLink = TASK_VIEW_LINK;

	status: TrelloConflictStatus = 'open';
	rows: TrelloConflictRow[] = [];
	/** How many conflicts the list reads. */
	take = CONFLICTS_PAGE;
	loading = false;
	/** The conflict being resolved (one at a time). */
	resolving: string | null = null;
	error: string | null = null;
	notice: string | null = null;

	/** Task titles by id, each read once (missing: not readable, the link says "Open the task"). */
	private readonly titles = new Map<string, string>();
	private readonly titlesAsked = new Set<string>();
	/** The value cells shown whole (`<conflict id>:<side>`). */
	private readonly expanded = new Set<string>();
	private listing: Subscription | null = null;

	/** Whether the route may hold more than the list read (it read a full page, below the route's limit). */
	get canShowMore(): boolean {
		return this.rows.length >= this.take && this.take < CONFLICTS_MAX;
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['integrationId'] || changes['runId']) {
			this.take = CONFLICTS_PAGE;
			this.load();
		}
	}

	/**
	 * Reads the list again (the filters as they are). A read in flight is dropped first, so an older answer never
	 * replaces a newer one. `keepMessages`: the line a resolve just wrote stays.
	 */
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
			.conflicts(this.integrationId, { status: this.status, runId: this.runId, take: this.take })
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

	changeStatus(status: TrelloConflictStatus): void {
		if (status === this.status) return;
		this.status = status;
		this.rows = [];
		this.take = CONFLICTS_PAGE;
		this.load();
	}

	showMore(): void {
		if (!this.canShowMore) return;
		this.take = Math.min(this.take + CONFLICTS_PAGE, CONFLICTS_MAX);
		this.load(true);
	}

	clearRun(): void {
		this.runIdChange.emit(null);
	}

	titleOf(taskId: string): string | null {
		return this.titles.get(taskId) ?? null;
	}

	isExpanded(row: TrelloConflictRow, side: ConflictSide): boolean {
		return this.expanded.has(`${row.conflict.id}:${side}`);
	}

	/** Shows a cut value whole, or cut again. */
	toggle(row: TrelloConflictRow, side: ConflictSide): void {
		const key = `${row.conflict.id}:${side}`;
		if (!this.expanded.delete(key)) this.expanded.add(key);
		this.cdr.markForCheck();
	}

	/**
	 * Keeps Trello's value (`external`) or writes the task's back (`platform`). Refused when the task changed since
	 * (409: the list says why and keeps the conflict) or when it is resolved already (404: the list is read again).
	 * Resolved, the conflict leaves the list and the list is read again (the next older one comes up).
	 */
	resolve(row: TrelloConflictRow, keep: TrelloConflictKeep): void {
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
					this.notice = this.translate.instant(keep === 'platform' ? 'TRELLO.CONFLICTS.KEPT_PLATFORM' : 'TRELLO.CONFLICTS.KEPT_EXTERNAL');
					this.load(true);
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

	/** The titles of the tasks not asked for yet, in one read per 25. */
	private readTitles(conflicts: readonly TrelloConflict[]): void {
		const first = conflicts.find((conflict) => conflict.tenantId && conflict.organizationId);
		const missing = [...new Set(conflicts.map((conflict) => conflict.taskId))].filter((taskId) => taskId && !this.titlesAsked.has(taskId));
		if (!first || !missing.length) return;
		for (const taskId of missing) this.titlesAsked.add(taskId);
		const scope = { tenantId: first.tenantId, organizationId: first.organizationId };
		for (let start = 0; start < missing.length; start += TASK_TITLES_MAX) {
			const chunk = missing.slice(start, start + TASK_TITLES_MAX);
			this.api
				.taskTitles(scope, chunk)
				.pipe(takeUntilDestroyed(this.destroyRef))
				.subscribe((titles) => {
					// The read failed: these titles are asked again on the next read of the list.
					if (!titles) {
						for (const taskId of chunk) this.titlesAsked.delete(taskId);
						return;
					}
					for (const [taskId, title] of Object.entries(titles)) this.titles.set(taskId, title);
					this.cdr.markForCheck();
				});
		}
	}
}
