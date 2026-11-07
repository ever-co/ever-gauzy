import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, distinctUntilChanged, filter, map, merge, Subject, switchMap, of, catchError, tap, take } from 'rxjs';
import { Store } from '@gauzy/ui-core/core';
import { TRELLO_LINK } from '../../integration-trello-ui.plugin';
import { TrelloConnectionSummary, TrelloStatus, TrelloUiService } from '../../services/trello-ui.service';
import { errorText, isNotFound, tokenOfFragment } from '../shared/trello-ui.utils';

/** What the page shows. */
export type TrelloPageView = 'loading' | 'unavailable' | 'not-configured' | 'connect' | 'connecting' | 'connected' | 'error';

/**
 * Integrations → Trello: the status of the selected organization. Where the API's Trello plugin is not loaded
 * (404) it only says so; where the application is not configured it says that; otherwise it offers Connect (the
 * API mints a single-use state and names Trello's authorize page), or shows the connection with a way to its
 * settings. Trello sends the person back here with the token in the URL fragment (`#token=`) and the state in
 * the query: the page posts both to the API, which writes the connection, then opens the settings (the token
 * leaves the address at once).
 */
@Component({
	selector: 'ngx-trello-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, NbAlertModule, NbButtonModule, NbCardModule, TranslatePipe],
	template: `
		<nb-card>
			<nb-card-header>{{ 'TRELLO.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@if (returnError) {
					<nb-alert status="danger" role="alert" data-test="return-error">{{ returnError }}</nb-alert>
				}
				@switch (view) {
					@case ('loading') {
						<p data-test="loading">{{ 'TRELLO.LOADING' | translate }}</p>
					}
					@case ('connecting') {
						<p data-test="connecting">{{ 'TRELLO.CONNECT.FINISHING' | translate }}</p>
					}
					@case ('unavailable') {
						<nb-alert status="basic" data-test="unavailable">{{ 'TRELLO.UNAVAILABLE' | translate }}</nb-alert>
					}
					@case ('not-configured') {
						<nb-alert status="warning" data-test="not-configured">{{ 'TRELLO.NOT_CONFIGURED' | translate }}</nb-alert>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{ error }}</nb-alert>
						<button nbButton ghost size="small" type="button" data-test="retry" (click)="reload$.next()">{{ 'TRELLO.RETRY' | translate }}</button>
					}
					@case ('connect') {
						<h5 data-test="connect">{{ 'TRELLO.CONNECT.TITLE' | translate }}</h5>
						<p>{{ 'TRELLO.CONNECT.TEXT' | translate }}</p>
						@if (connectError) {
							<nb-alert status="danger" role="alert" data-test="connect-error">{{ connectError }}</nb-alert>
						}
						<button nbButton status="primary" type="button" data-test="connect-button" [disabled]="connecting" (click)="connect()">
							{{ (connecting ? 'TRELLO.CONNECT.STARTING' : 'TRELLO.CONNECT.BUTTON') | translate }}
						</button>
					}
					@case ('connected') {
						<h5 data-test="connected">{{ 'TRELLO.CONNECTED.TITLE' | translate }}</h5>
						@if (connection?.attentionReason) {
							<nb-alert status="warning" role="alert" data-test="attention">
								{{ 'TRELLO.CONNECTED.ATTENTION' | translate: { reason: ('TRELLO.CONNECTED.REASONS.' + connection.attentionReason | translate) } }}
							</nb-alert>
						}
						<dl class="facts">
							<dt>{{ 'TRELLO.CONNECTED.MEMBER' | translate }}</dt>
							<dd data-test="member">{{ connection?.trelloMemberName || connection?.trelloMemberUsername || '—' }}</dd>
							<dt>{{ 'TRELLO.CONNECTED.CONNECTED_ON' | translate }}</dt>
							<dd>{{ connection?.createdAt ? (connection.createdAt | date: 'medium') : '—' }}</dd>
						</dl>
						<button nbButton status="primary" type="button" data-test="open-settings" (click)="openSettings()">
							{{ 'TRELLO.CONNECTED.OPEN_SETTINGS' | translate }}
						</button>
						@if (connection?.attentionReason) {
							<button nbButton ghost type="button" class="reconnect" data-test="reconnect" [disabled]="connecting" (click)="connect()">
								{{ 'TRELLO.CONNECT.BUTTON' | translate }}
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
export class TrelloPageComponent implements OnInit {
	private readonly api = inject(TrelloUiService);
	private readonly store = inject(Store);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	readonly reload$ = new Subject<void>();
	view: TrelloPageView = 'loading';
	error: string | null = null;
	connectError: string | null = null;
	/** What went wrong when the token Trello returned was handed to the API. */
	returnError: string | null = null;
	connecting = false;
	/** The return from Trello being finished (the status is not read until it is). */
	finishing = false;
	organizationId: string | null = null;
	status: TrelloStatus | null = null;
	connection: TrelloConnectionSummary | null = null;

	ngOnInit(): void {
		const organizations$ = this.store.selectedOrganization$.pipe(
			map((organization) => organization?.id ?? null),
			distinctUntilChanged(),
			tap((organizationId) => (this.organizationId = organizationId))
		);
		// Trello's return: `#token=` in the fragment, `?state=` in the query. Known at once — the status is not read while
		// it is being finished — and finished once, as soon as the organization is known: the store may say null first
		// (a full page load), and a return taken on that emission would lose the token.
		combineLatest([this.route.fragment, this.route.queryParamMap])
			.pipe(
				take(1),
				map(([fragment, params]) => ({ token: tokenOfFragment(fragment), state: params.get('state') })),
				filter((back): back is { token: string; state: string } => !!back.token && !!back.state),
				tap(() => (this.finishing = true)),
				switchMap((back) =>
					organizations$.pipe(
						filter((organizationId): organizationId is string => !!organizationId),
						take(1),
						map((organizationId) => ({ ...back, organizationId }))
					)
				),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(({ organizationId, token, state }) => this.finishReturn(organizationId, token, state));
		combineLatest([merge(organizations$, this.reload$.pipe(map(() => this.organizationId)))])
			.pipe(
				switchMap(([organizationId]) => {
					if (this.finishing) return of<{ status: TrelloStatus | null; view: TrelloPageView }>({ status: null, view: 'connecting' });
					this.view = 'loading';
					this.error = null;
					this.cdr.markForCheck();
					if (!organizationId) return of<{ status: TrelloStatus | null; view: TrelloPageView }>({ status: null, view: 'loading' });
					return this.api.status(organizationId).pipe(
						map((status) => ({ status, view: this.viewOf(status) })),
						catchError((error) => of({ status: null, view: isNotFound(error) ? ('unavailable' as const) : ('error' as const), error }))
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((result: { status: TrelloStatus | null; view: TrelloPageView; error?: unknown }) => {
				if (this.finishing) return;
				this.status = result.status;
				this.connection = result.status?.connection ?? null;
				this.view = result.view;
				this.error = result.error ? errorText(result.error) : null;
				this.cdr.markForCheck();
			});
	}

	/** What the status means for the page. */
	viewOf(status: TrelloStatus): TrelloPageView {
		if (status.connection) return 'connected';
		return status.configured ? 'connect' : 'not-configured';
	}

	/** Starts the connect flow: the API's single-use state, then Trello's authorize page in this tab. */
	connect(): void {
		if (!this.organizationId || this.connecting) return;
		this.connecting = true;
		this.connectError = null;
		this.cdr.markForCheck();
		this.api.installState(this.organizationId).subscribe({
			next: ({ authorizeUrl }) => {
				this.leaveTo(authorizeUrl);
			},
			error: (error) => {
				this.connecting = false;
				this.connectError = errorText(error);
				this.cdr.markForCheck();
			}
		});
	}

	/** Hands the token Trello returned to the API with the flow's state; the settings open, the token leaves the address. */
	finishReturn(organizationId: string, token: string, state: string): void {
		this.finishing = true;
		this.view = 'connecting';
		this.cdr.markForCheck();
		this.api.connect(organizationId, token, state).subscribe({
			next: (connection) => {
				this.finishing = false;
				void this.router.navigate([TRELLO_LINK, connection.id], { replaceUrl: true });
			},
			error: (error) => {
				this.finishing = false;
				this.returnError = errorText(error);
				// The address keeps no token: the page is opened again without it, and the status read.
				void this.router.navigate([TRELLO_LINK], { replaceUrl: true }).then(() => this.reload$.next());
			}
		});
	}

	openSettings(): void {
		if (this.connection) void this.router.navigate([TRELLO_LINK, this.connection.id]);
	}

	/** Sends this tab to Trello (a method so a test can watch it). */
	leaveTo(url: string): void {
		window.location.assign(url);
	}
}
