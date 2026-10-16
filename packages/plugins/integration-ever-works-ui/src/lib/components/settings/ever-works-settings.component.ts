import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule, NbInputModule, NbTabsetModule, NbToggleModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, forkJoin, merge, Observable, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { Store } from '@gauzy/ui-core/core';
import type {
	EverWorksConflict,
	EverWorksConnection,
	EverWorksMapping,
	EverWorksStatus,
	EverWorksSyncLogEntry,
	EverWorksSyncStatus
} from '../../services/ever-works.service';
import { EverWorksUiService } from '../../services/ever-works.service';
import { EverWorksDirectionsComponent } from '../directions/ever-works-directions.component';
import { EverWorksMatchReviewComponent } from '../match-review/ever-works-match-review.component';
import { EverWorksPreviewComponent } from '../preview/ever-works-preview.component';
import { errorText } from '../shared/ever-works-ui.utils';

/** What the page shows. */
export type EverWorksSettingsView = 'loading' | 'ready' | 'unavailable' | 'not-found' | 'error';

/** The status is read again this often while a sync is running. */
export const SETTINGS_POLL_MS = 10_000;

type Loaded =
	| { status: EverWorksStatus; connection: EverWorksConnection | null; mapping: EverWorksMapping | null; sync: EverWorksSyncStatus | null }
	| { error: HttpErrorResponse };

/**
 * The sync settings of one organization mapping (`/pages/integrations/ever-works/:integrationTenantId`,
 * plan 06 G-P1-11), in tabs:
 *
 * - **Overview**: the connection's state, the lag against Ever Works' feed, the queues (pending,
 *   deferred, failed, dead), open conflicts, the last error, link totals and the running or last sync with
 *   its phases; Resync, cancel a running sync, pause and resume. A mapping that never synced offers the
 *   dry run and Start.
 * - **Mapping**: the match review (people, agents, teams, projects).
 * - **Entities and directions**.
 * - **Activity**: the sync log (filters, more) and the conflicts, with "Keep" and "Use the other value".
 * - **Advanced**: switch the mapping on or off, replace the integration key, register the webhook again,
 *   disconnect (confirmed twice; synced data is kept on both sides).
 *
 * The mapping must be the selected organization's: another organization's mapping is not shown.
 */
@Component({
	selector: 'ngx-ever-works-settings',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		FormsModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbTabsetModule,
		NbToggleModule,
		RouterLink,
		TranslatePipe,
		EverWorksDirectionsComponent,
		EverWorksMatchReviewComponent,
		EverWorksPreviewComponent
	],
	template: `
		<nb-card>
			<nb-card-header>
				{{ 'EVER_WORKS.TITLE' | translate }}
				@if (mapping) {
					— {{ mapping.everWorksOrganization.displayName || mapping.everWorksOrganization.slug }}
				}
			</nb-card-header>
			<nb-card-body>
				@if (notice) {
					<nb-alert status="success" role="status" data-test="notice">{{ notice | translate: noticeParams }}</nb-alert>
				}
				@if (error) {
					<nb-alert status="danger" role="alert" data-test="action-error">{{ error }}</nb-alert>
				}
				@switch (view) {
					@case ('loading') {
						<p data-test="loading">{{ 'EVER_WORKS.COMMON.LOADING' | translate }}</p>
					}
					@case ('unavailable') {
						<p data-test="unavailable">{{ 'EVER_WORKS.UNAVAILABLE' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{ 'EVER_WORKS.ERROR' | translate }}</nb-alert>
						<button nbButton ghost size="small" type="button" data-test="retry" (click)="reload()">{{ 'EVER_WORKS.RETRY' | translate }}</button>
					}
					@case ('not-found') {
						<p data-test="not-found">{{ 'EVER_WORKS.SETTINGS.NOT_FOUND' | translate }}</p>
						<a nbButton status="primary" routerLink="/pages/integrations/ever-works">{{ 'EVER_WORKS.SETTINGS.BACK_TO_CONNECT' | translate }}</a>
					}
					@case ('ready') {
						<nb-tabset>
							<nb-tab [tabTitle]="'EVER_WORKS.SETTINGS.TABS.OVERVIEW' | translate" data-test="tab-overview">
								@if (connection && connection.status !== 'active') {
									<nb-alert status="warning" data-test="connection-state">{{
										'EVER_WORKS.SETTINGS.CONNECTION_STATE.' + connection.status | translate
									}}</nb-alert>
								}
								@if (sync) {
									<dl class="facts" data-test="overview">
										<dt>{{ 'EVER_WORKS.SETTINGS.STATUS' | translate }}</dt>
										<dd data-test="status">{{ 'EVER_WORKS.SETTINGS.CONNECTION_STATUS.' + sync.connection.status | translate }}</dd>
										<dt>{{ 'EVER_WORKS.SETTINGS.LAG' | translate }}</dt>
										<dd data-test="lag">
											@if (sync.lag.behind !== null) {
												{{ 'EVER_WORKS.SETTINGS.BEHIND' | translate: { count: sync.lag.behind } }}
											} @else {
												{{ sync.lag.headError || '—' }}
											}
										</dd>
										<dt>{{ 'EVER_WORKS.SETTINGS.INBOUND' | translate }}</dt>
										<dd data-test="inbound">{{ 'EVER_WORKS.SETTINGS.QUEUE' | translate: sync.inbound }}</dd>
										<dt>{{ 'EVER_WORKS.SETTINGS.OUTBOUND' | translate }}</dt>
										<dd data-test="outbound">{{ 'EVER_WORKS.SETTINGS.QUEUE' | translate: sync.outbound }}</dd>
										<dt>{{ 'EVER_WORKS.SETTINGS.CONFLICTS' | translate }}</dt>
										<dd data-test="open-conflicts">{{ sync.conflicts.open }}</dd>
										<dt>{{ 'EVER_WORKS.SETTINGS.LAST_FEED' | translate }}</dt>
										<dd>{{ sync.connection.lastFeedPollAt ? (sync.connection.lastFeedPollAt | date: 'medium') : '—' }}</dd>
										<dt>{{ 'EVER_WORKS.SETTINGS.LAST_WEBHOOK' | translate }}</dt>
										<dd>{{ sync.connection.lastWebhookAt ? (sync.connection.lastWebhookAt | date: 'medium') : '—' }}</dd>
										@if (sync.lastError) {
											<dt>{{ 'EVER_WORKS.SETTINGS.LAST_ERROR' | translate }}</dt>
											<dd data-test="last-error">
												<code>{{ sync.lastError.action }}</code> {{ sync.lastError.message }}
												<small>({{ sync.lastError.at | date: 'medium' }})</small>
											</dd>
										}
										@if (sync.connection.lastError) {
											<dt>{{ 'EVER_WORKS.SETTINGS.CONNECTION_ERROR' | translate }}</dt>
											<dd><code>{{ sync.connection.lastError }}</code></dd>
										}
									</dl>
									@if (sync.entities.length) {
										<table class="table" data-test="entities">
											<thead>
												<tr>
													<th>{{ 'EVER_WORKS.SETTINGS.RECORDS' | translate }}</th>
													<th>{{ 'EVER_WORKS.SETTINGS.LINKED' | translate }}</th>
													<th>{{ 'EVER_WORKS.SETTINGS.IN_CONFLICT' | translate }}</th>
													<th>{{ 'EVER_WORKS.SETTINGS.IN_ERROR' | translate }}</th>
													<th>{{ 'EVER_WORKS.SETTINGS.NOT_SYNCED' | translate }}</th>
												</tr>
											</thead>
											<tbody>
												@for (row of sync.entities; track row.entityType) {
													<tr>
														<td>{{ row.entityType }}</td>
														<td>{{ row.ok }}</td>
														<td>{{ row.conflict }}</td>
														<td>{{ row.error + row.orphaned }}</td>
														<td>{{ row.unlinked }}</td>
													</tr>
												}
											</tbody>
										</table>
									}
									@if (latestRun; as run) {
										<h6 data-test="run">
											{{ (run.mode === 'initial' ? 'EVER_WORKS.SETTINGS.RUN_INITIAL' : 'EVER_WORKS.SETTINGS.RUN_RESYNC') | translate }}:
											{{ 'EVER_WORKS.SETTINGS.RUN_STATUS.' + run.status | translate }}
										</h6>
										@if (run.lastError) {
											<p><code>{{ run.lastError }}</code></p>
										}
										<ul class="phases" data-test="phases">
											@for (phase of run.phases; track phase.name) {
												<li [class.current]="phase.name === run.currentPhase && run.status === 'running'">
													{{ 'EVER_WORKS.PHASES.' + phase.name | translate }}:
													{{ 'EVER_WORKS.SETTINGS.PHASE_STATUS.' + phase.status | translate }}
													@if (phase.queued || phase.exported) {
														<small>({{ 'EVER_WORKS.SETTINGS.PHASE_COUNTS' | translate: phase }})</small>
													}
													@if (phase.message) {
														<small class="note">{{ phase.message }}</small>
													}
												</li>
											}
										</ul>
									}
									<div class="actions">
										<button nbButton ghost type="button" data-test="refresh" [disabled]="busy" (click)="refreshStatus()">{{ 'EVER_WORKS.COMMON.REFRESH' | translate }}</button>
										@if (sync.run) {
											<button nbButton status="warning" type="button" data-test="cancel-run" [disabled]="busy" (click)="cancelRun()">
												{{ 'EVER_WORKS.SETTINGS.CANCEL_RUN' | translate }}
											</button>
										} @else if (sync.runs.length) {
											<button nbButton status="primary" type="button" data-test="resync" [disabled]="busy || !canSync" (click)="resync()">
												{{ 'EVER_WORKS.SETTINGS.RESYNC' | translate }}
											</button>
										}
										@if (connection?.status === 'active') {
											<button nbButton ghost type="button" data-test="pause" [disabled]="busy" (click)="pause()">{{ 'EVER_WORKS.SETTINGS.PAUSE' | translate }}</button>
										} @else if (connection && connection.status !== 'disconnected') {
											<button nbButton status="primary" type="button" data-test="resume" [disabled]="busy" (click)="resume()">{{ 'EVER_WORKS.SETTINGS.RESUME' | translate }}</button>
										}
									</div>
									@if (!sync.runs.length && !sync.run) {
										<section class="first-sync" data-test="first-sync">
											<h6>{{ 'EVER_WORKS.SETTINGS.FIRST_SYNC' | translate }}</h6>
											<ngx-ever-works-preview [organizationId]="organizationId" [integrationTenantId]="integrationTenantId" />
											<button nbButton status="success" type="button" data-test="start-first" [disabled]="busy || !canSync" (click)="startFirstSync()">
												{{ 'EVER_WORKS.PREVIEW.START' | translate }}
											</button>
										</section>
									}
								}
							</nb-tab>
							<nb-tab [tabTitle]="'EVER_WORKS.SETTINGS.TABS.MAPPING' | translate" data-test="tab-mapping">
								<ngx-ever-works-match-review [organizationId]="organizationId" [integrationTenantId]="integrationTenantId" />
							</nb-tab>
							<nb-tab [tabTitle]="'EVER_WORKS.SETTINGS.TABS.DIRECTIONS' | translate" data-test="tab-directions">
								<ngx-ever-works-directions [organizationId]="organizationId" [mapping]="mapping" (savedMapping)="mapping = $event" />
							</nb-tab>
							<nb-tab [tabTitle]="'EVER_WORKS.SETTINGS.TABS.ACTIVITY' | translate" data-test="tab-activity">
								<h6>{{ 'EVER_WORKS.SETTINGS.CONFLICTS' | translate }}</h6>
								<div class="filters">
									<select class="form-control" name="conflictsState" data-test="conflicts-state" [(ngModel)]="conflictsState" (ngModelChange)="loadConflicts(true)">
										<option value="open">{{ 'EVER_WORKS.SETTINGS.CONFLICTS_OPEN' | translate }}</option>
										<option value="resolved">{{ 'EVER_WORKS.SETTINGS.CONFLICTS_RESOLVED' | translate }}</option>
										<option value="all">{{ 'EVER_WORKS.SETTINGS.ALL' | translate }}</option>
									</select>
								</div>
								@if (!conflicts.length) {
									<p data-test="no-conflicts">{{ 'EVER_WORKS.SETTINGS.NO_CONFLICTS' | translate }}</p>
								} @else {
									<table class="table" data-test="conflicts">
										<thead>
											<tr>
												<th>{{ 'EVER_WORKS.SETTINGS.WHEN' | translate }}</th>
												<th>{{ 'EVER_WORKS.SETTINGS.RECORD' | translate }}</th>
												<th>{{ 'EVER_WORKS.SETTINGS.FIELD' | translate }}</th>
												<th>{{ 'EVER_WORKS.REVIEW.GAUZY' | translate }}</th>
												<th>{{ 'EVER_WORKS.REVIEW.EVER_WORKS' | translate }}</th>
												<th></th>
											</tr>
										</thead>
										<tbody>
											@for (conflict of conflicts; track conflict.id) {
												<tr [attr.data-test]="'conflict-' + conflict.id">
													<td>{{ conflict.createdAt | date: 'medium' }}</td>
													<td>{{ conflict.entityType }}</td>
													<td>{{ conflict.details?.field || '—' }}</td>
													<td [class.winner]="conflict.details?.winner === 'gauzy'">{{ show(conflict.details?.gauzyValue) }}</td>
													<td [class.winner]="conflict.details?.winner === 'ever_works'">{{ show(conflict.details?.everWorksValue) }}</td>
													<td>
														@if (conflict.resolved) {
															{{ 'EVER_WORKS.SETTINGS.RESOLVED_AS.' + (conflict.details?.resolution || 'keep') | translate }}
														} @else {
															<button nbButton ghost size="tiny" type="button" data-test="keep" [disabled]="busy" (click)="resolve(conflict, 'keep')">
																{{ 'EVER_WORKS.SETTINGS.KEEP' | translate }}
															</button>
															@if (conflict.canUseOther) {
																<button nbButton status="primary" size="tiny" type="button" data-test="use-other" [disabled]="busy" (click)="resolve(conflict, 'use_other')">
																	{{ 'EVER_WORKS.SETTINGS.USE_OTHER' | translate }}
																</button>
															}
														}
													</td>
												</tr>
											}
										</tbody>
									</table>
									@if (conflictsCursor) {
										<button nbButton ghost size="small" type="button" data-test="more-conflicts" (click)="loadConflicts(false)">{{ 'EVER_WORKS.SETTINGS.MORE' | translate }}</button>
									}
								}
								<h6>{{ 'EVER_WORKS.SETTINGS.LOG' | translate }}</h6>
								<div class="filters">
									<select class="form-control" name="logStatus" data-test="log-status" [(ngModel)]="logStatus" (ngModelChange)="loadLog(true)">
										<option value="">{{ 'EVER_WORKS.SETTINGS.ALL' | translate }}</option>
										@for (status of logStatuses; track status) {
											<option [value]="status">{{ 'EVER_WORKS.SETTINGS.LOG_STATUS.' + status | translate }}</option>
										}
									</select>
									<select class="form-control" name="logDirection" data-test="log-direction" [(ngModel)]="logDirection" (ngModelChange)="loadLog(true)">
										<option value="">{{ 'EVER_WORKS.SETTINGS.ALL' | translate }}</option>
										@for (direction of logDirections; track direction) {
											<option [value]="direction">{{ 'EVER_WORKS.SETTINGS.LOG_DIRECTION.' + direction | translate }}</option>
										}
									</select>
								</div>
								<table class="table" data-test="log">
									<tbody>
										@for (entry of log; track entry.id) {
											<tr [class.failed]="entry.status === 'error'">
												<td>{{ entry.createdAt | date: 'medium' }}</td>
												<td>{{ 'EVER_WORKS.SETTINGS.LOG_DIRECTION.' + entry.direction | translate }}</td>
												<td>{{ entry.entityType || '—' }}</td>
												<td><code>{{ entry.action }}</code></td>
												<td>{{ 'EVER_WORKS.SETTINGS.LOG_STATUS.' + entry.status | translate }}</td>
												<td>{{ entry.message }}</td>
											</tr>
										}
									</tbody>
								</table>
								@if (logCursor) {
									<button nbButton ghost size="small" type="button" data-test="more-log" (click)="loadLog(false)">{{ 'EVER_WORKS.SETTINGS.MORE' | translate }}</button>
								}
							</nb-tab>
							<nb-tab [tabTitle]="'EVER_WORKS.SETTINGS.TABS.ADVANCED' | translate" data-test="tab-advanced">
								<section>
									<nb-toggle data-test="mapping-enabled" [checked]="!!mapping?.isEnabled" [disabled]="busy" (checkedChange)="setEnabled($event)">
										{{ 'EVER_WORKS.SETTINGS.ENABLED' | translate }}
									</nb-toggle>
								</section>
								@if (connection) {
									<section>
										<h6>{{ 'EVER_WORKS.SETTINGS.KEY_TITLE' | translate }}</h6>
										<p>{{ 'EVER_WORKS.SETTINGS.KEY_CURRENT' | translate: { name: connection.key.name || '—', prefix: connection.key.prefix || '—' } }}</p>
										<input
											nbInput
											fullWidth
											name="newKey"
											type="password"
											autocomplete="new-password"
											spellcheck="false"
											data-test="new-key"
											[placeholder]="'EVER_WORKS.CONNECT.KEY' | translate"
											[(ngModel)]="newKey"
											[disabled]="busy"
										/>
										<div class="actions">
											<button nbButton status="primary" type="button" data-test="rotate-key" [disabled]="busy || !newKey.trim()" (click)="rotateKey()">
												{{ 'EVER_WORKS.SETTINGS.ROTATE_KEY' | translate }}
											</button>
											<button nbButton ghost type="button" data-test="register-webhook" [disabled]="busy || connection.status !== 'active'" (click)="registerWebhook()">
												{{ 'EVER_WORKS.SETTINGS.REGISTER_WEBHOOK' | translate }}
											</button>
										</div>
									</section>
									<section class="danger">
										<h6>{{ 'EVER_WORKS.SETTINGS.DISCONNECT_TITLE' | translate }}</h6>
										<p>{{ 'EVER_WORKS.SETTINGS.DISCONNECT_HINT' | translate }}</p>
										@if (!confirmDisconnect) {
											<button nbButton status="danger" outline type="button" data-test="disconnect" [disabled]="busy" (click)="confirmDisconnect = true">
												{{ 'EVER_WORKS.SETTINGS.DISCONNECT' | translate }}
											</button>
										} @else {
											<button nbButton status="danger" type="button" data-test="confirm-disconnect" [disabled]="busy" (click)="disconnect()">
												{{ 'EVER_WORKS.SETTINGS.CONFIRM_DISCONNECT' | translate }}
											</button>
											<button nbButton ghost type="button" [disabled]="busy" (click)="confirmDisconnect = false">{{ 'EVER_WORKS.COMMON.BACK' | translate }}</button>
										}
									</section>
								}
							</nb-tab>
						</nb-tabset>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.facts {
				display: grid;
				grid-template-columns: max-content 1fr;
				gap: 0.25rem 1rem;
			}
			.actions,
			.filters {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
				margin: 1rem 0;
			}
			.phases .current {
				font-weight: 600;
			}
			.note {
				display: block;
				opacity: 0.8;
			}
			.winner {
				font-weight: 600;
			}
			.failed {
				color: var(--color-danger-default, #c00);
			}
			section {
				margin-bottom: 1.5rem;
			}
		`
	]
})
export class EverWorksSettingsComponent implements OnInit, OnDestroy {
	private readonly api = inject(EverWorksUiService);
	private readonly store = inject(Store);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	readonly logStatuses = ['ok', 'skipped', 'conflict', 'error'];
	readonly logDirections = ['inbound', 'outbound', 'system'];

	view: EverWorksSettingsView = 'loading';
	integrationTenantId: string | null = null;
	organizationId: string | null = null;
	status: EverWorksStatus | null = null;
	connection: EverWorksConnection | null = null;
	mapping: EverWorksMapping | null = null;
	sync: EverWorksSyncStatus | null = null;
	log: EverWorksSyncLogEntry[] = [];
	logCursor: string | null = null;
	logStatus = '';
	logDirection = '';
	conflicts: EverWorksConflict[] = [];
	conflictsCursor: string | null = null;
	conflictsState: 'open' | 'resolved' | 'all' = 'open';
	newKey = '';
	confirmDisconnect = false;
	busy = false;
	error: string | null = null;
	notice: string | null = null;
	noticeParams: Record<string, unknown> = {};
	private readonly reload$ = new Subject<void>();
	private pollTimer: ReturnType<typeof setTimeout> | null = null;

	/** The running sync, else the latest one. */
	get latestRun() {
		return this.sync?.run ?? this.sync?.runs?.[0] ?? null;
	}

	/** A sync can start: the mapping is on and the connection is active. */
	get canSync(): boolean {
		return !!this.mapping?.isEnabled && this.connection?.status === 'active';
	}

	ngOnInit(): void {
		const ids$ = this.route.paramMap.pipe(
			map((params) => params.get('integrationTenantId')),
			distinctUntilChanged()
		);
		const organizations$ = this.store.selectedOrganization$.pipe(
			map((organization) => organization?.id ?? null),
			distinctUntilChanged()
		);
		// The route, the organization and retries share one switchMap: the last one wins.
		combineLatest([ids$, organizations$])
			.pipe(
				switchMap(([id, organizationId]) =>
					merge(of(undefined), this.reload$).pipe(
						switchMap(() => {
							this.clearPoll();
							this.integrationTenantId = id;
							this.organizationId = organizationId;
							this.view = 'loading';
							this.sync = null;
							this.cdr.markForCheck();
							return this.load$(id, organizationId);
						})
					)
				),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((result) => this.apply(result));
	}

	ngOnDestroy(): void {
		this.clearPoll();
	}

	reload(): void {
		this.reload$.next();
	}

	// ── Overview ───────────────────────────────────────────────────────────────────────────────────

	refreshStatus(): void {
		const id = this.integrationTenantId;
		if (!id) return;
		this.clearPoll();
		this.api.syncStatus(this.organizationId, id).subscribe({
			next: (sync) => {
				this.sync = sync;
				this.schedulePoll();
				this.cdr.markForCheck();
			},
			error: (error) => this.fail(error)
		});
	}

	resync(): void {
		this.act(this.api.resync(this.organizationId, this.id), () => this.done('EVER_WORKS.SETTINGS.RESYNC_STARTED'), true);
	}

	cancelRun(): void {
		this.act(this.api.cancelSync(this.organizationId, this.id), () => this.done('EVER_WORKS.SETTINGS.RUN_CANCELLED'), true);
	}

	/** The first sync of a mapping that never synced: the webhook (best effort), then the run. */
	startFirstSync(): void {
		const connection = this.connection;
		const webhook$ =
			connection && !connection.webhook?.registered
				? this.api.registerWebhook(this.organizationId, connection.id).pipe(
						map(() => null as string | null),
						catchError((error) => of(errorText(error)))
					)
				: of(null as string | null);
		this.act(
			webhook$.pipe(switchMap((webhookError) => this.api.startSync(this.organizationId, this.id).pipe(map(() => webhookError)))),
			(webhookError) =>
				webhookError ? this.done('EVER_WORKS.PREVIEW.WEBHOOK_NOT_REGISTERED', { reason: webhookError }) : this.done('EVER_WORKS.SETTINGS.SYNC_STARTED'),
			true
		);
	}

	pause(): void {
		if (!this.connection) return;
		this.act(this.api.pause(this.organizationId, this.connection.id), (connection) => {
			this.connection = connection;
			this.done('EVER_WORKS.SETTINGS.PAUSED');
		}, true);
	}

	resume(): void {
		if (!this.connection) return;
		this.act(this.api.resume(this.organizationId, this.connection.id), (connection) => {
			this.connection = connection;
			this.done('EVER_WORKS.SETTINGS.RESUMED');
		}, true);
	}

	// ── Activity ───────────────────────────────────────────────────────────────────────────────────

	loadLog(reset: boolean): void {
		const id = this.integrationTenantId;
		if (!id) return;
		const cursor = reset ? null : this.logCursor;
		this.api.syncLog(this.organizationId, id, { status: this.logStatus || null, direction: this.logDirection || null, cursor }).subscribe({
			next: (page) => {
				this.log = reset ? page.items : [...this.log, ...page.items];
				this.logCursor = page.nextCursor;
				this.cdr.markForCheck();
			},
			error: (error) => this.fail(error)
		});
	}

	loadConflicts(reset: boolean): void {
		const id = this.integrationTenantId;
		if (!id) return;
		const cursor = reset ? null : this.conflictsCursor;
		this.api.conflicts(this.organizationId, id, this.conflictsState, cursor).subscribe({
			next: (page) => {
				this.conflicts = reset ? page.items : [...this.conflicts, ...page.items];
				this.conflictsCursor = page.nextCursor;
				this.cdr.markForCheck();
			},
			error: (error) => this.fail(error)
		});
	}

	resolve(conflict: EverWorksConflict, resolution: 'keep' | 'use_other'): void {
		this.act(this.api.resolveConflict(this.organizationId, this.id, conflict.id, resolution), () => {
			this.done(resolution === 'use_other' ? 'EVER_WORKS.SETTINGS.USED_OTHER' : 'EVER_WORKS.SETTINGS.KEPT');
			this.loadConflicts(true);
		}, true);
	}

	/** A conflict value as text (objects and lists as JSON, cut to a readable length). */
	show(value: unknown): string {
		if (value === null || value === undefined || value === '') return '—';
		const text = typeof value === 'string' ? value : JSON.stringify(value);
		return text.length > 120 ? `${text.slice(0, 117)}…` : text;
	}

	// ── Advanced ───────────────────────────────────────────────────────────────────────────────────

	setEnabled(isEnabled: boolean): void {
		if (!this.mapping) return;
		this.act(this.api.updateMapping(this.organizationId, this.id, { isEnabled }), (mapping) => {
			this.mapping = mapping;
			this.done(isEnabled ? 'EVER_WORKS.SETTINGS.ENABLED_ON' : 'EVER_WORKS.SETTINGS.ENABLED_OFF');
		}, true);
	}

	rotateKey(): void {
		const key = this.newKey.trim();
		if (!this.connection || !key) return;
		this.act(this.api.rotateKey(this.organizationId, this.connection.id, key), (connection) => {
			this.connection = connection;
			// The key leaves the form once the API has it.
			this.newKey = '';
			this.done('EVER_WORKS.SETTINGS.KEY_ROTATED');
		}, true);
	}

	registerWebhook(): void {
		if (!this.connection) return;
		this.act(this.api.registerWebhook(this.organizationId, this.connection.id), (connection) => {
			this.connection = connection;
			this.done('EVER_WORKS.SETTINGS.WEBHOOK_REGISTERED');
		});
	}

	disconnect(): void {
		if (!this.connection) return;
		this.act(this.api.disconnect(this.organizationId, this.connection.id), () => {
			this.confirmDisconnect = false;
			void this.router.navigate(['/pages/integrations/ever-works']);
		});
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	private get id(): string {
		return this.integrationTenantId as string;
	}

	/** The status gate (404: not loaded), the connection and mapping, then the mapping's sync status. */
	private load$(id: string | null, organizationId: string | null): Observable<Loaded> {
		return this.api.status(organizationId).pipe(
			switchMap((status) =>
				forkJoin({ connection: this.api.connection(organizationId), mapping: this.api.currentMapping(organizationId) }).pipe(
					switchMap(({ connection, mapping }) =>
						// Only the selected organization's own mapping is shown here.
						!mapping || !id || mapping.integrationTenantId !== id
							? of({ status, connection: connection ?? null, mapping: null, sync: null })
							: this.api.syncStatus(organizationId, id).pipe(map((sync) => ({ status, connection: connection ?? null, mapping, sync })))
					)
				)
			),
			catchError((error: HttpErrorResponse) => of({ error }))
		);
	}

	private apply(result: Loaded): void {
		if ('error' in result) {
			this.view = result.error?.status === 404 && !this.status ? 'unavailable' : 'error';
		} else {
			this.status = result.status;
			this.connection = result.connection;
			this.mapping = result.mapping;
			this.sync = result.sync;
			this.view = result.mapping ? 'ready' : 'not-found';
			if (result.mapping) {
				this.loadLog(true);
				this.loadConflicts(true);
				this.schedulePoll();
			}
		}
		this.cdr.markForCheck();
	}

	/** Runs an action; `refresh` reads the status again afterwards. */
	private act<T>(request: Observable<T>, then: (value: T) => void, refresh = false): void {
		this.busy = true;
		this.error = null;
		this.notice = null;
		this.cdr.markForCheck();
		request.subscribe({
			next: (value) => {
				this.busy = false;
				then(value);
				if (refresh) this.refreshStatus();
				this.cdr.markForCheck();
			},
			error: (error) => {
				this.busy = false;
				this.fail(error);
			}
		});
	}

	private done(notice: string, params: Record<string, unknown> = {}): void {
		this.notice = notice;
		this.noticeParams = params;
	}

	private fail(error: unknown): void {
		this.error = errorText(error);
		this.cdr.markForCheck();
	}

	/** While a sync runs, the status is read again every {@link SETTINGS_POLL_MS}. */
	private schedulePoll(): void {
		this.clearPoll();
		if (this.sync?.run?.status !== 'running') return;
		this.pollTimer = setTimeout(() => this.refreshStatus(), SETTINGS_POLL_MS);
	}

	private clearPoll(): void {
		if (this.pollTimer) clearTimeout(this.pollTimer);
		this.pollTimer = null;
	}
}
