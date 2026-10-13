import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbAlertModule, NbButtonModule, NbCardModule, NbIconModule, NbToggleModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { LastPayloadViewerComponent } from '../last-payload-viewer/last-payload-viewer.component';
import {
	EVER_STATS_SCHEMA_URL,
	EverStatsLastPayload,
	EverStatsPreview,
	EverStatsSendResult,
	EverStatsStatus,
	EverStatsUiService
} from '../../services/ever-stats.service';

/** What the page shows. */
export type UsageStatisticsView = 'loading' | 'operator' | 'managed' | 'error';

/**
 * Settings > Anonymous usage statistics.
 *
 * - The operator of the installation (the API answers `status`): the switch, why nothing is sent,
 *   the next report, what is sent (a live preview), the last payload, Send now and Reset instance
 *   identity (behind a confirmation).
 * - Everyone else, and every installation where the module is not loaded (the API answers 404):
 *   "Managed by the instance operator" and the published schema, never a payload, because the report
 *   covers every tenant of the installation.
 */
@Component({
	selector: 'ngx-ever-stats-usage-statistics-settings',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		NbToggleModule,
		TranslateModule,
		LastPayloadViewerComponent
	],
	template: `
		<!-- Same vocabulary as Settings > File Storage / Custom SMTP: 12px body, hairline
		     panels with an icon + title header, label | value rows, small buttons. -->
		<nb-card class="stats-card">
			<nb-card-header class="stats-header">{{ 'EVER_STATS.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<p class="intro">{{ 'EVER_STATS.INTRO' | translate }}</p>
				@switch (view) {
					@case ('managed') {
						<section class="panel" data-test="managed">
							<header class="panel-header">
								<span class="panel-mark" aria-hidden="true"><nb-icon icon="lock-outline"></nb-icon></span>
								<div class="panel-heading">
									<h3 class="panel-title">{{ 'EVER_STATS.MANAGED' | translate }}</h3>
									<p class="panel-subtitle">{{ 'EVER_STATS.MANAGED_DESCRIPTION' | translate }}</p>
								</div>
							</header>
							<p class="note" data-test="managed-operators">
								<nb-icon icon="info-outline" aria-hidden="true"></nb-icon>
								<span>{{ 'EVER_STATS.MANAGED_OPERATORS' | translate }}</span>
							</p>
							<footer class="panel-footer">
								<a class="schema-link" [href]="schemaUrl" target="_blank" rel="noopener noreferrer">
									{{ 'EVER_STATS.SCHEMA_LINK' | translate }}
									<nb-icon icon="external-link-outline" aria-hidden="true"></nb-icon>
								</a>
							</footer>
						</section>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{ 'EVER_STATS.ERROR' | translate }}</nb-alert>
					}
					@case ('operator') {
						<section class="operator" data-test="operator">
							@if (status?.reason === 'config' || status?.reason === 'key_unreadable') {
								<nb-alert status="danger" role="alert" data-test="reason">{{ 'EVER_STATS.REASON.' + status.reason | translate }}</nb-alert>
							}
							@if (status?.key_warning) {
								<nb-alert status="warning" data-test="key-warning">{{ 'EVER_STATS.KEY_WARNING.' + status.key_warning | translate }}</nb-alert>
							}
							@if (notice) {
								<nb-alert [status]="noticeStatus" role="status" data-test="notice">{{ notice | translate }}</nb-alert>
							}

							<!-- Status: the switch, then the facts as label | value rows, then the actions. -->
							<section class="panel">
								<header class="panel-header">
									<span class="panel-mark" aria-hidden="true"><nb-icon icon="bar-chart-outline"></nb-icon></span>
									<div class="panel-heading">
										<nb-toggle data-test="toggle" [checked]="status?.enabled" [disabled]="busy" (checkedChange)="toggle($event)">
											{{ 'EVER_STATS.ENABLED' | translate }}
										</nb-toggle>
									</div>
								</header>
								<dl class="facts">
									<div class="fact">
										<dt>{{ 'EVER_STATS.ENABLED' | translate }}</dt>
										<dd data-test="state">
											<span class="status-dot" [class.on]="status?.enabled" aria-hidden="true"></span>
											{{ (status?.enabled ? 'EVER_STATS.STATE.ON' : 'EVER_STATS.STATE.OFF') | translate }}
										</dd>
									</div>
									@if (status?.enabled && status?.next_send_at) {
										<div class="fact">
											<dt>{{ 'EVER_STATS.NEXT_SEND' | translate }}</dt>
											<dd data-test="next-send">{{ status.next_send_at | date: 'medium' }}</dd>
										</div>
									}
									@if (status?.last_attempt) {
										<div class="fact">
											<dt>{{ 'EVER_STATS.LAST_ATTEMPT' | translate }}</dt>
											<dd data-test="last-attempt">
												{{ status.last_attempt.status }}
												@if (status.last_attempt.http_status) {
													({{ status.last_attempt.http_status }})
												}
												@if (status.last_attempt.at) {
													· {{ status.last_attempt.at | date: 'medium' }}
												}
												@if (status.last_attempt.error) {
													· <code>{{ status.last_attempt.error }}</code>
												}
											</dd>
										</div>
									}
									<div class="fact">
										<dt>{{ 'EVER_STATS.INSTALL_SOURCE' | translate }}</dt>
										<dd>{{ status?.install_source || '—' }}</dd>
									</div>
									<div class="fact">
										<dt>{{ 'EVER_STATS.COUNTRY' | translate }}</dt>
										<dd>{{ status?.country === 'ZZ' ? ('EVER_STATS.COUNTRY_UNDECLARED' | translate) : status?.country || '—' }}</dd>
									</div>
									<div class="fact">
										<dt>{{ 'EVER_STATS.DESTINATION' | translate }}</dt>
										<dd data-test="destination">
											@if (status?.api_url) {
												<code>{{ status.api_url }}/v1/stats/reports</code>
											} @else {
												—
											}
										</dd>
									</div>
								</dl>
								<footer class="panel-footer actions">
									<a class="schema-link" [href]="schemaUrl" target="_blank" rel="noopener noreferrer">
										{{ 'EVER_STATS.SCHEMA_LINK' | translate }}
										<nb-icon icon="external-link-outline" aria-hidden="true"></nb-icon>
									</a>
									<button nbButton size="small" status="primary" type="button" data-test="send-now" [disabled]="busy || !status?.enabled || !!status?.reason" (click)="sendNow()">
										<nb-icon icon="paper-plane-outline"></nb-icon>
										{{ 'EVER_STATS.SEND_NOW' | translate }}
									</button>
								</footer>
							</section>

							<section class="panel">
								<header class="panel-header plain">
									<div class="panel-heading">
										<h3 class="panel-title">{{ 'EVER_STATS.WHAT_IS_SENT' | translate }}</h3>
										<p class="panel-subtitle">{{ 'EVER_STATS.WHAT_IS_SENT_DESCRIPTION' | translate }}</p>
									</div>
								</header>
								<div class="panel-body">
									@if (preview) {
										<ngx-ever-stats-payload-viewer data-test="preview" [payload]="preview.payload" [bytes]="preview.bytes" />
									} @else {
										<button nbButton size="small" ghost status="primary" type="button" data-test="show-preview" [disabled]="busy" (click)="loadPreview()">
											<nb-icon icon="eye-outline"></nb-icon>
											{{ 'EVER_STATS.SHOW_PREVIEW' | translate }}
										</button>
									}
								</div>
							</section>

							<section class="panel">
								<header class="panel-header plain">
									<div class="panel-heading">
										<h3 class="panel-title">{{ 'EVER_STATS.LAST_PAYLOAD' | translate }}</h3>
										<p class="panel-subtitle">{{ 'EVER_STATS.LAST_PAYLOAD_DESCRIPTION' | translate }}</p>
									</div>
								</header>
								<div class="panel-body">
									@if (last) {
										<ngx-ever-stats-payload-viewer
											data-test="last"
											[payload]="last.payload"
											[bytes]="last.bytes"
											[sentAt]="last.sent_at"
											[httpStatus]="last.http_status"
										/>
									} @else {
										<p class="empty" data-test="no-last">{{ 'EVER_STATS.NO_LAST_PAYLOAD' | translate }}</p>
									}
								</div>
							</section>

							<!-- Irreversible action: its own danger-tinted panel, behind a confirmation. -->
							<section class="panel danger">
								<header class="panel-header plain">
									<div class="panel-heading">
										<h3 class="panel-title">{{ 'EVER_STATS.RESET' | translate }}</h3>
									</div>
								</header>
								<div class="panel-body">
									@if (confirmingReset) {
										<section class="confirm" data-test="reset-confirmation">
											<strong>{{ 'EVER_STATS.RESET_CONFIRM_TITLE' | translate }}</strong>
											<p>{{ 'EVER_STATS.RESET_CONFIRM_TEXT' | translate }}</p>
											<div class="actions">
												<button nbButton size="small" ghost status="basic" type="button" data-test="reset-cancel" [disabled]="busy" (click)="confirmingReset = false">
													{{ 'EVER_STATS.CANCEL' | translate }}
												</button>
												<button nbButton size="small" status="danger" type="button" data-test="reset-confirm" [disabled]="busy" (click)="confirmReset()">
													{{ 'EVER_STATS.RESET_CONFIRM' | translate }}
												</button>
											</div>
										</section>
									} @else {
										<button nbButton size="small" status="danger" ghost type="button" data-test="reset" [disabled]="busy" (click)="confirmingReset = true">
											<nb-icon icon="refresh-outline"></nb-icon>
											{{ 'EVER_STATS.RESET' | translate }}
										</button>
									}
								</div>
							</section>
							<p class="note">
								<nb-icon icon="info-outline" aria-hidden="true"></nb-icon>
								<span>{{ 'EVER_STATS.DISABLE_BY_ENV' | translate }}</span>
							</p>
						</section>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			/* Every custom property carries a fallback: --gauzy-* is undefined in the material themes. */
			:host {
				--stats-border: var(--gauzy-border-default-color, var(--border-basic-color-3, rgba(126, 126, 143, 0.24)));
				--stats-muted: var(--text-hint-color, rgba(126, 126, 143, 1));
				--stats-radius: var(--gauzy-radius-sm, 0.5rem);
				--stats-mono: var(--font-family-monospace, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
				display: block;
			}
			.stats-header {
				font-size: 1rem;
				font-weight: 600;
				line-height: 1.5rem;
			}
			.intro {
				max-width: 60rem;
				margin: 0 0 1rem;
				font-size: 0.75rem;
				line-height: 1.125rem;
				color: var(--stats-muted);
			}
			.operator {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}
			/* Alerts as transparent tints with a hairline (File Storage's notes), not solid blocks. */
			nb-alert {
				margin: 0;
				padding: 0.625rem 0.75rem;
				border-radius: var(--stats-radius);
				font-size: 0.75rem;
				font-weight: 400;
				line-height: 1.125rem;
				color: var(--text-basic-color);
			}
			nb-alert.status-warning {
				background: var(--color-warning-transparent-default, rgba(255, 170, 0, 0.08));
				box-shadow: inset 0 0 0 1px var(--color-warning-transparent-active, rgba(255, 170, 0, 0.24));
			}
			nb-alert.status-danger {
				background: var(--color-danger-transparent-default, rgba(255, 61, 113, 0.08));
				box-shadow: inset 0 0 0 1px var(--color-danger-transparent-active, rgba(255, 61, 113, 0.24));
			}
			nb-alert.status-success {
				background: var(--color-success-transparent-default, rgba(0, 214, 143, 0.08));
				box-shadow: inset 0 0 0 1px var(--color-success-transparent-active, rgba(0, 214, 143, 0.24));
			}

			/* Panel: hairline, no fill, no shadow. */
			.panel {
				overflow: hidden;
				border-radius: var(--stats-radius);
				box-shadow: inset 0 0 0 1px var(--stats-border);
				font-size: 0.75rem;
			}
			.panel.danger {
				box-shadow: inset 0 0 0 1px var(--color-danger-transparent-active, rgba(255, 61, 113, 0.32));
			}
			.panel-header {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				padding: 0.875rem 1rem;
				border-bottom: 1px solid var(--stats-border);
			}
			.panel-header.plain {
				padding: 0.75rem 1rem 0.625rem;
			}
			.panel-mark {
				display: inline-flex;
				flex: 0 0 auto;
				align-items: center;
				justify-content: center;
				width: 2rem;
				height: 2rem;
				border-radius: var(--stats-radius);
				background: var(--color-primary-transparent-default, rgba(51, 102, 255, 0.08));
				color: var(--color-primary-default);
			}
			.panel-mark nb-icon {
				font-size: 1.125rem;
			}
			.panel-heading {
				min-width: 0;
			}
			.panel-title {
				margin: 0;
				font-size: 0.875rem;
				font-weight: 600;
				line-height: 1.25rem;
			}
			/* Font sizes are set on each text element: the theme's global paragraph rule
			   (~15px) beats a size inherited from the panel. */
			.panel-subtitle {
				margin: 0.125rem 0 0;
				font-size: 0.75rem;
				line-height: 1.125rem;
				color: var(--stats-muted);
			}
			.panel-body {
				padding: 0.75rem 1rem;
			}
			.panel-footer {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				padding: 0.625rem 1rem;
				border-top: 1px solid var(--stats-border);
			}
			nb-toggle ::ng-deep .text {
				font-size: 0.875rem;
				font-weight: 600;
			}

			/* Facts: label | value rows with a hairline between them. */
			.facts {
				margin: 0;
			}
			.fact {
				display: grid;
				grid-template-columns: minmax(8rem, 14rem) minmax(0, 1fr);
				gap: 0.25rem 1rem;
				padding: 0.5rem 1rem;
			}
			.fact + .fact {
				border-top: 1px solid var(--stats-border);
			}
			@media (max-width: 575.98px) {
				.fact {
					grid-template-columns: minmax(0, 1fr);
				}
			}
			.fact dt {
				font-weight: 400;
				color: var(--stats-muted);
			}
			.fact dd {
				font-weight: 400;
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.25rem;
				min-width: 0;
				margin: 0;
				color: var(--text-basic-color);
				overflow-wrap: anywhere;
			}
			.status-dot {
				width: 0.5rem;
				height: 0.5rem;
				border-radius: 50%;
				background: var(--color-basic-500, rgba(126, 126, 143, 0.6));
			}
			.status-dot.on {
				background: var(--color-success-default);
			}
			code {
				padding: 0.0625rem 0.3125rem;
				border-radius: 0.25rem;
				background: var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12));
				font-family: var(--stats-mono);
				font-size: 0.6875rem;
				color: var(--text-basic-color);
			}

			/* Actions and links. */
			.actions {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.5rem;
			}
			button[nbButton] {
				margin: 0;
				text-transform: none;
			}
			button[nbButton] nb-icon {
				font-size: 1rem;
			}
			.schema-link {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				font-size: 0.75rem;
				font-weight: 500;
			}
			.schema-link nb-icon {
				font-size: 0.875rem;
			}
			.empty {
				margin: 0;
				font-size: 0.75rem;
				color: var(--stats-muted);
			}
			.confirm strong {
				font-weight: 600;
			}
			.confirm p {
				margin: 0.25rem 0 0.75rem;
				font-size: 0.75rem;
				line-height: 1.125rem;
				color: var(--stats-muted);
			}

			/* A quiet note: icon + muted text, no box. */
			.note {
				display: flex;
				align-items: flex-start;
				gap: 0.5rem;
				margin: 0;
				padding: 0.75rem 1rem;
				font-size: 0.75rem;
				line-height: 1.125rem;
				color: var(--stats-muted);
			}
			.panel > .note {
				border-bottom: 1px solid var(--stats-border);
			}
			.operator > .note {
				padding: 0;
			}
			.note nb-icon {
				flex: 0 0 auto;
				margin-top: 0.0625rem;
				font-size: 0.875rem;
			}
		`
	]
})
export class UsageStatisticsSettingsComponent implements OnInit {
	private readonly api = inject(EverStatsUiService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	readonly schemaUrl = EVER_STATS_SCHEMA_URL;
	view: UsageStatisticsView = 'loading';
	status: EverStatsStatus | null = null;
	last: EverStatsLastPayload | null = null;
	preview: EverStatsPreview | null = null;
	busy = false;
	confirmingReset = false;
	notice: string | null = null;
	noticeStatus: 'success' | 'warning' | 'danger' = 'success';

	ngOnInit(): void {
		this.load();
	}

	/** Reads the status; 404 means "not the operator here" (or the module is not loaded). */
	load(): void {
		this.api
			.status()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (status) => {
					this.status = status;
					this.view = 'operator';
					this.cdr.markForCheck();
					this.loadLast();
				},
				error: (error: HttpErrorResponse) => {
					this.view = error?.status === 404 ? 'managed' : 'error';
					this.cdr.markForCheck();
				}
			});
	}

	toggle(enabled: boolean): void {
		this.busy = true;
		this.api
			.setEnabled(enabled)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (status) => this.done(status),
				error: () => this.fail('EVER_STATS.ERROR')
			});
	}

	loadPreview(): void {
		this.busy = true;
		this.api
			.preview()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (preview) => {
					this.preview = preview;
					this.busy = false;
					this.cdr.markForCheck();
				},
				error: () => this.fail('EVER_STATS.ERROR')
			});
	}

	sendNow(): void {
		this.busy = true;
		this.api
			.sendNow()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (result: EverStatsSendResult) => {
					const sent = !result.skipped && result.reports.length > 0 && result.reports.every((r) => r.status === 'sent');
					this.notice = sent ? 'EVER_STATS.SENT' : result.skipped ? 'EVER_STATS.SEND_SKIPPED' : 'EVER_STATS.SEND_FAILED';
					this.noticeStatus = sent ? 'success' : 'warning';
					this.refresh();
				},
				error: (error: HttpErrorResponse) => this.fail(error?.status === 429 ? 'EVER_STATS.SEND_TOO_SOON' : 'EVER_STATS.ERROR')
			});
	}

	confirmReset(): void {
		this.busy = true;
		this.api
			.resetIdentity()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (status) => {
					this.confirmingReset = false;
					this.preview = null;
					this.notice = 'EVER_STATS.RESET_DONE';
					this.noticeStatus = 'success';
					this.done(status);
				},
				error: () => this.fail('EVER_STATS.ERROR')
			});
	}

	private refresh(): void {
		this.api
			.status()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({ next: (status) => this.done(status), error: () => this.fail('EVER_STATS.ERROR') });
		this.loadLast();
	}

	private loadLast(): void {
		this.api
			.last()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (last) => {
					this.last = last;
					this.cdr.markForCheck();
				},
				error: () => {
					this.last = null;
					this.cdr.markForCheck();
				}
			});
	}

	private done(status: EverStatsStatus): void {
		this.status = status;
		this.busy = false;
		this.cdr.markForCheck();
	}

	private fail(message: string): void {
		this.busy = false;
		this.notice = message;
		this.noticeStatus = 'danger';
		this.cdr.markForCheck();
	}
}
