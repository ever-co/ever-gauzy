import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { NbAlertModule, NbButtonModule, NbCardModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { distinctUntilChanged, forkJoin, merge, Observable, of, Subject } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Store } from '@gauzy/ui-core/core';
import { EverWorksConnection, EverWorksMapping, EverWorksStatus, EverWorksUiService } from '../../services/ever-works.service';
import { EverWorksConnectComponent, EverWorksConnectResult } from '../connect/ever-works-connect.component';
import { newKeyUrlOf } from '../shared/ever-works-ui.utils';

export { EVER_WORKS_NEW_KEY_PATH } from '../shared/ever-works-ui.utils';

/** What the page shows. */
export type EverWorksView = 'loading' | 'ready' | 'unavailable' | 'error';

/** Once the plugin answers: is this organization connected and mapped? */
export type EverWorksSetup = 'checking' | 'connect' | 'connected' | 'error';

type Loaded =
	| { status: EverWorksStatus; connection: EverWorksConnection | null; mapping: EverWorksMapping | null; setupError: boolean }
	| { error: HttpErrorResponse };

/**
 * Integrations > Ever Works (`/pages/integrations/ever-works`).
 *
 * The page asks the API first. When the API answers 404 the plugin is not loaded on this installation
 * (`EVER_WORKS_ENABLED` is not `true`, the default): the page says so and makes no other request.
 * Otherwise it reads the tenant's connection and this organization's mapping: a mapped organization
 * links to its sync settings, any other one gets the connect wizard (plan 02 §1).
 */
@Component({
	selector: 'ngx-ever-works-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbAlertModule, NbButtonModule, NbCardModule, RouterLink, TranslatePipe, EverWorksConnectComponent],
	template: `
		<nb-card>
			<nb-card-header>{{ 'EVER_WORKS.TITLE' | translate }}</nb-card-header>
			<nb-card-body>
				@switch (view) {
					@case ('unavailable') {
						<p data-test="unavailable">{{ 'EVER_WORKS.UNAVAILABLE' | translate }}</p>
					}
					@case ('error') {
						<nb-alert status="danger" role="alert" data-test="error">{{ 'EVER_WORKS.ERROR' | translate }}</nb-alert>
						<button nbButton ghost size="small" type="button" data-test="retry" (click)="load()">{{ 'EVER_WORKS.RETRY' | translate }}</button>
					}
					@case ('ready') {
						<p data-test="ready">{{ 'EVER_WORKS.READY' | translate }}</p>
						<p>{{ 'EVER_WORKS.INTRO' | translate }}</p>
						@if (status?.defaultApiUrl) {
							<p data-test="default-api-url">
								{{ 'EVER_WORKS.DEFAULT_API_URL' | translate }}: <code>{{ status.defaultApiUrl }}</code>
							</p>
						}
						@switch (setup) {
							@case ('checking') {
								<p data-test="checking">{{ 'EVER_WORKS.CHECKING' | translate }}</p>
							}
							@case ('error') {
								<nb-alert status="danger" role="alert" data-test="setup-error">{{ 'EVER_WORKS.ERROR' | translate }}</nb-alert>
								<button nbButton ghost size="small" type="button" (click)="load()">{{ 'EVER_WORKS.RETRY' | translate }}</button>
							}
							@case ('connected') {
								<nb-alert status="success" data-test="connected">{{
									'EVER_WORKS.CONNECTED.TITLE' | translate: { name: mapping?.everWorksOrganization?.displayName || mapping?.everWorksOrganization?.slug }
								}}</nb-alert>
								<a nbButton status="primary" data-test="open-settings" [routerLink]="settingsLink">{{ 'EVER_WORKS.CONNECTED.OPEN_SETTINGS' | translate }}</a>
							}
							@case ('connect') {
								<ngx-ever-works-connect
									[organizationId]="organizationId"
									[organizationName]="organizationName"
									[defaultApiUrl]="status?.defaultApiUrl ?? null"
									[newKeyUrl]="newKeyUrl"
									[connection]="connection"
									[mapping]="mapping"
									(started)="started($event)"
								/>
							}
						}
						<p class="versions" data-test="versions">
							{{ 'EVER_WORKS.VERSIONS' | translate: { plugin: status?.pluginVersion, contract: status?.contractVersion } }}
						</p>
					}
				}
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			.versions {
				opacity: 0.7;
				font-size: 0.85em;
				margin-top: 1.5rem;
			}
		`
	]
})
export class EverWorksPageComponent implements OnInit {
	private readonly api = inject(EverWorksUiService);
	private readonly store = inject(Store);
	private readonly router = inject(Router);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);

	view: EverWorksView = 'loading';
	setup: EverWorksSetup = 'checking';
	protected status: EverWorksStatus | null = null;
	protected connection: EverWorksConnection | null = null;
	protected mapping: EverWorksMapping | null = null;
	protected organizationId: string | null = null;
	protected organizationName: string | null = null;
	/** Retries of the current organization's status; they share the stream organization changes switch. */
	private readonly reload$ = new Subject<void>();

	/** The Ever Works page that creates an integration key, when the operator configured the app URL. */
	protected get newKeyUrl(): string | null {
		return newKeyUrlOf(this.status?.appUrl);
	}

	protected get settingsLink(): string[] {
		return ['/pages/integrations/ever-works', this.mapping?.integrationTenantId ?? ''];
	}

	ngOnInit(): void {
		const organizations$ = this.store.selectedOrganization$.pipe(
			distinctUntilChanged((a, b) => a?.id === b?.id),
			tap((organization) => {
				this.organizationId = organization?.id ?? null;
				this.organizationName = (organization as { name?: string } | null)?.name ?? null;
			})
		);
		// Organization changes and retries share one switchMap: whichever comes last replaces the request in
		// flight, so a late answer for a previous organization (or an earlier retry) never wins.
		merge(organizations$, this.reload$)
			.pipe(
				switchMap(() => {
					// A new request starts: the previous organization's status (and its key link) must not stay
					// on screen while it runs.
					this.status = null;
					this.connection = null;
					this.mapping = null;
					this.view = 'loading';
					this.setup = 'checking';
					this.cdr.markForCheck();
					return this.load$(this.organizationId);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((result) => this.apply(result));
	}

	/** Reads the status for the selected organization again (a retry). */
	load(): void {
		this.reload$.next();
	}

	/** The wizard started the first sync: on to the mapping's settings. */
	started(result: EverWorksConnectResult): void {
		this.mapping = result.mapping;
		this.setup = 'connected';
		this.cdr.markForCheck();
		void this.router.navigate(['/pages/integrations/ever-works', result.mapping.integrationTenantId]);
	}

	/** The status (404: the plugin is not loaded), then the connection and the mapping of the organization. */
	private load$(organizationId: string | null): Observable<Loaded> {
		return this.api.status(organizationId).pipe(
			switchMap((status) =>
				forkJoin({ connection: this.api.connection(organizationId), mapping: this.api.currentMapping(organizationId) }).pipe(
					map(({ connection, mapping }) => ({ status, connection: connection ?? null, mapping: mapping ?? null, setupError: false })),
					catchError(() => of({ status, connection: null, mapping: null, setupError: true }))
				)
			),
			catchError((error: HttpErrorResponse) => of({ error }))
		);
	}

	private apply(result: Loaded): void {
		if ('status' in result) {
			this.status = result.status;
			this.connection = result.connection;
			this.mapping = result.mapping;
			this.view = 'ready';
			this.setup = result.setupError ? 'error' : result.mapping ? 'connected' : 'connect';
		} else {
			this.status = null;
			this.view = result.error?.status === 404 ? 'unavailable' : 'error';
		}
		this.cdr.markForCheck();
	}
}
