import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NbAlertModule, NbButtonModule, NbCardModule, NbToggleModule } from '@nebular/theme';
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
	imports: [DatePipe, NbAlertModule, NbButtonModule, NbCardModule, NbToggleModule, TranslateModule, LastPayloadViewerComponent],
	template: `
		<nb-card>
			<nb-card-header>{{ 'EVER_STATS.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				<p>{{ 'EVER_STATS.INTRO' | translate }}</p>
				@switch (view) {
					@case ('managed') {
						<section data-test="managed">
							<h3>{{ 'EVER_STATS.MANAGED' | translate }}</h3>
							<p>{{ 'EVER_STATS.MANAGED_DESCRIPTION' | translate }}</p>
							<p class="hint" data-test="managed-operators">{{ 'EVER_STATS.MANAGED_OPERATORS' | translate }}</p>
							<a [href]="schemaUrl" target="_blank" rel="noopener noreferrer">{{ 'EVER_STATS.SCHEMA_LINK' | translate }}</a>
						</section>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{ 'EVER_STATS.ERROR' | translate }}</nb-alert>
					}
					@case ('operator') {
						<section data-test="operator">
							@if (status?.reason === 'config' || status?.reason === 'key_unreadable') {
								<nb-alert status="danger" role="alert" data-test="reason">{{ 'EVER_STATS.REASON.' + status.reason | translate }}</nb-alert>
							}
							@if (status?.key_warning) {
								<nb-alert status="warning" data-test="key-warning">{{ 'EVER_STATS.KEY_WARNING.' + status.key_warning | translate }}</nb-alert>
							}
							@if (notice) {
								<nb-alert [status]="noticeStatus" role="status" data-test="notice">{{ notice | translate }}</nb-alert>
							}
							<nb-toggle data-test="toggle" [checked]="status?.enabled" [disabled]="busy" (checkedChange)="toggle($event)">
								{{ 'EVER_STATS.ENABLED' | translate }}
							</nb-toggle>
							<dl class="facts">
								<dt>{{ 'EVER_STATS.ENABLED' | translate }}</dt>
								<dd data-test="state">{{ (status?.enabled ? 'EVER_STATS.STATE.ON' : 'EVER_STATS.STATE.OFF') | translate }}</dd>
								@if (status?.enabled && status?.next_send_at) {
									<dt>{{ 'EVER_STATS.NEXT_SEND' | translate }}</dt>
									<dd data-test="next-send">{{ status.next_send_at | date: 'medium' }}</dd>
								}
								@if (status?.last_attempt) {
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
								}
								<dt>{{ 'EVER_STATS.INSTALL_SOURCE' | translate }}</dt>
								<dd>{{ status?.install_source }}</dd>
								<dt>{{ 'EVER_STATS.COUNTRY' | translate }}</dt>
								<dd>{{ status?.country === 'ZZ' ? ('EVER_STATS.COUNTRY_UNDECLARED' | translate) : status?.country }}</dd>
								<dt>{{ 'EVER_STATS.DESTINATION' | translate }}</dt>
								<dd data-test="destination">
									@if (status?.api_url) {
										<code>{{ status.api_url }}/v1/stats/reports</code>
									} @else {
										—
									}
								</dd>
							</dl>
							<div class="actions">
								<button nbButton status="primary" type="button" data-test="send-now" [disabled]="busy || !status?.enabled || !!status?.reason" (click)="sendNow()">
									{{ 'EVER_STATS.SEND_NOW' | translate }}
								</button>
								<a [href]="schemaUrl" target="_blank" rel="noopener noreferrer">{{ 'EVER_STATS.SCHEMA_LINK' | translate }}</a>
							</div>

							<h3>{{ 'EVER_STATS.WHAT_IS_SENT' | translate }}</h3>
							<p>{{ 'EVER_STATS.WHAT_IS_SENT_DESCRIPTION' | translate }}</p>
							@if (preview) {
								<ngx-ever-stats-payload-viewer data-test="preview" [payload]="preview.payload" [bytes]="preview.bytes" />
							} @else {
								<button nbButton ghost type="button" data-test="show-preview" [disabled]="busy" (click)="loadPreview()">
									{{ 'EVER_STATS.SHOW_PREVIEW' | translate }}
								</button>
							}

							<h3>{{ 'EVER_STATS.LAST_PAYLOAD' | translate }}</h3>
							<p>{{ 'EVER_STATS.LAST_PAYLOAD_DESCRIPTION' | translate }}</p>
							@if (last) {
								<ngx-ever-stats-payload-viewer
									data-test="last"
									[payload]="last.payload"
									[bytes]="last.bytes"
									[sentAt]="last.sent_at"
									[httpStatus]="last.http_status"
								/>
							} @else {
								<p data-test="no-last">{{ 'EVER_STATS.NO_LAST_PAYLOAD' | translate }}</p>
							}

							<h3>{{ 'EVER_STATS.RESET' | translate }}</h3>
							@if (confirmingReset) {
								<section class="confirm" data-test="reset-confirmation">
									<strong>{{ 'EVER_STATS.RESET_CONFIRM_TITLE' | translate }}</strong>
									<p>{{ 'EVER_STATS.RESET_CONFIRM_TEXT' | translate }}</p>
									<div class="actions">
										<button nbButton status="danger" type="button" data-test="reset-confirm" [disabled]="busy" (click)="confirmReset()">
											{{ 'EVER_STATS.RESET_CONFIRM' | translate }}
										</button>
										<button nbButton ghost type="button" data-test="reset-cancel" [disabled]="busy" (click)="confirmingReset = false">
											{{ 'EVER_STATS.CANCEL' | translate }}
										</button>
									</div>
								</section>
							} @else {
								<button nbButton status="danger" ghost type="button" data-test="reset" [disabled]="busy" (click)="confirmingReset = true">
									{{ 'EVER_STATS.RESET' | translate }}
								</button>
							}
							<p class="hint">{{ 'EVER_STATS.DISABLE_BY_ENV' | translate }}</p>
						</section>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.facts {
				display: grid;
				grid-template-columns: max-content auto;
				gap: 4px 16px;
				margin: 16px 0;
			}
			.actions {
				display: flex;
				gap: 12px;
				align-items: center;
				margin: 12px 0;
			}
			h3 {
				margin-top: 24px;
			}
			.hint {
				margin-top: 24px;
				opacity: 0.8;
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
