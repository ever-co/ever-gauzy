import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, distinctUntilChanged, map, merge, Subject, switchMap, of, catchError, tap } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { JIRA_LINK } from '../../integration-jira-ui.plugin';
import { JiraConnectionSummary, JiraStatus, JiraUiService } from '../../services/jira-ui.service';
import { errorText, isNotFound } from '../shared/jira-ui.utils';

/** What the page shows. */
export type JiraPageView = 'loading' | 'unavailable' | 'not-configured' | 'connect' | 'connected' | 'error';

/** The errors the API's callback may send the person back with (`?error=`). */
const CALLBACK_ERRORS = new Set(['not_configured', 'denied', 'invalid_state', 'exchange_failed', 'site_unreadable', 'no_site', 'site_mismatch', 'not_saved']);

/**
 * Integrations → Jira: the status of the selected organization. Where the API's Jira sync is not loaded
 * (404) it only says so; where the OAuth app is not configured it says that; otherwise it offers Connect
 * (the API mints a single-use state and names the Atlassian page to go to), or shows the connection with a
 * way to its settings. The API's callback sends the person back here with `?integrationId=` (then the
 * settings open, where a connection whose token reaches several sites chooses one) or `?error=`.
 */
@Component({
	selector: 'ngx-jira-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, NbAlertModule, NbButtonModule, NbCardModule, TranslatePipe],
	template: `
		<nb-card>
			<nb-card-header>{{ 'JIRA.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@if (callbackError) {
					<nb-alert status="danger" role="alert" data-test="callback-error">{{ 'JIRA.CALLBACK_ERRORS.' + callbackError | translate }}</nb-alert>
				}
				<!-- Above every view: a connect started from the connected view (a reconnect) fails visibly too. -->
				@if (connectError) {
					<nb-alert status="danger" role="alert" data-test="connect-error">{{ connectError }}</nb-alert>
				}
				@switch (view) {
					@case ('loading') {
						<p data-test="loading">{{ 'JIRA.LOADING' | translate }}</p>
					}
					@case ('unavailable') {
						<nb-alert status="basic" data-test="unavailable">{{ 'JIRA.UNAVAILABLE' | translate }}</nb-alert>
					}
					@case ('not-configured') {
						<nb-alert status="warning" data-test="not-configured">{{ 'JIRA.NOT_CONFIGURED' | translate }}</nb-alert>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{ error }}</nb-alert>
						<button nbButton ghost size="small" type="button" data-test="retry" (click)="reload$.next()">{{ 'JIRA.RETRY' | translate }}</button>
					}
					@case ('connect') {
						<h5 data-test="connect">{{ 'JIRA.CONNECT.TITLE' | translate }}</h5>
						<p>{{ 'JIRA.CONNECT.TEXT' | translate }}</p>
						<button nbButton status="primary" type="button" data-test="connect-button" [disabled]="connecting" (click)="connect()">
							{{ (connecting ? 'JIRA.CONNECT.STARTING' : 'JIRA.CONNECT.BUTTON') | translate }}
						</button>
					}
					@case ('connected') {
						<h5 data-test="connected">{{ 'JIRA.CONNECTED.TITLE' | translate }}</h5>
						@if (connection?.attentionReason) {
							<nb-alert status="warning" role="alert" data-test="attention">
								{{ 'JIRA.CONNECTED.ATTENTION' | translate: { reason: ('JIRA.CONNECTED.REASONS.' + connection.attentionReason | translate) } }}
							</nb-alert>
						}
						@if (connection?.siteRequired) {
							<nb-alert status="warning" role="alert" data-test="site-required">{{ 'JIRA.SITES.REQUIRED' | translate }}</nb-alert>
						}
						<dl class="facts">
							<dt>{{ 'JIRA.CONNECTED.SITE' | translate }}</dt>
							<dd data-test="site">{{ connection?.siteName || connection?.siteUrl || ('JIRA.SITES.NONE' | translate) }}</dd>
							<dt>{{ 'JIRA.CONNECTED.ACCOUNT' | translate }}</dt>
							<dd data-test="account">{{ connection?.accountName || '—' }}</dd>
							<dt>{{ 'JIRA.CONNECTED.CONNECTED_ON' | translate }}</dt>
							<dd>{{ connection?.createdAt ? (connection.createdAt | date: 'medium') : '—' }}</dd>
						</dl>
						<button nbButton status="primary" type="button" data-test="open-settings" (click)="openSettings()">
							{{ 'JIRA.CONNECTED.OPEN_SETTINGS' | translate }}
						</button>
						@if (connection?.attentionReason) {
							<button nbButton ghost type="button" class="reconnect" data-test="reconnect" [disabled]="connecting" (click)="connect()">
								{{ 'JIRA.CONNECT.BUTTON' | translate }}
							</button>
						}
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
				margin: 1rem 0;
			}
			.facts dt {
				opacity: 0.7;
			}
			.reconnect {
				margin-left: 0.5rem;
			}
		`
	]
})
export class JiraPageComponent implements OnInit {
	private readonly api = inject(JiraUiService);
	private readonly store = inject(Store);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	readonly reload$ = new Subject<void>();
	view: JiraPageView = 'loading';
	error: string | null = null;
	connectError: string | null = null;
	connecting = false;
	callbackError: string | null = null;
	organizationId: string | null = null;
	status: JiraStatus | null = null;
	connection: JiraConnectionSummary | null = null;

	ngOnInit(): void {
		// The API's callback lands here: `?integrationId=` opens the settings; `?error=` is shown above the page.
		this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
			const error = params.get('error');
			this.callbackError = error && CALLBACK_ERRORS.has(error) ? error : null;
			const integrationId = params.get('integrationId');
			if (integrationId) {
				void this.router.navigate([JIRA_LINK, integrationId], { replaceUrl: true });
			}
			this.cdr.markForCheck();
		});
		const organizations$ = this.store.selectedOrganization$.pipe(
			map((organization) => organization?.id ?? null),
			distinctUntilChanged(),
			tap((organizationId) => (this.organizationId = organizationId))
		);
		combineLatest([merge(organizations$, this.reload$.pipe(map(() => this.organizationId)))])
			.pipe(
				switchMap(([organizationId]) => {
					this.view = 'loading';
					this.error = null;
					this.cdr.markForCheck();
					if (!organizationId) return of<{ status: JiraStatus | null; view: JiraPageView }>({ status: null, view: 'loading' });
					return this.api.status(organizationId).pipe(
						map((status) => ({ status, view: this.viewOf(status) })),
						catchError((error) => of({ status: null, view: isNotFound(error) ? ('unavailable' as const) : ('error' as const), error }))
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((result: { status: JiraStatus | null; view: JiraPageView; error?: unknown }) => {
				this.status = result.status;
				this.connection = result.status?.connection ?? null;
				this.view = result.view;
				this.error = result.error ? errorText(result.error) : null;
				this.cdr.markForCheck();
			});
	}

	/** What the status means for the page. */
	viewOf(status: JiraStatus): JiraPageView {
		if (status.connection) return 'connected';
		return status.configured ? 'connect' : 'not-configured';
	}

	/** Starts the connect flow: the API's single-use state, then Jira's authorize page in this tab. */
	connect(): void {
		const organizationId = this.organizationId;
		if (!organizationId || this.connecting) return;
		this.connecting = true;
		this.connectError = null;
		this.cdr.markForCheck();
		this.api
			.installState(organizationId)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: ({ authorizeUrl }) => {
					// Another organization was selected meanwhile: this state is the former one's, so nobody is sent anywhere.
					if (organizationId !== this.organizationId) {
						this.connecting = false;
						this.cdr.markForCheck();
						return;
					}
					this.leaveTo(authorizeUrl);
				},
				error: (error) => {
					this.connecting = false;
					this.connectError = errorText(error);
					this.cdr.markForCheck();
				}
			});
	}

	openSettings(): void {
		if (this.connection) void this.router.navigate([JIRA_LINK, this.connection.id]);
	}

	/** Sends this tab to Jira (a method so a test can watch it). */
	leaveTo(url: string): void {
		window.location.assign(url);
	}
}
