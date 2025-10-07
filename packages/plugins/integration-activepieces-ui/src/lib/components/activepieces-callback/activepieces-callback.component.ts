import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ActivepiecesService, ToastrService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-callback',
	templateUrl: './activepieces-callback.component.html',
	standalone: false
})
export class ActivepiecesCallbackComponent extends TranslationBaseComponent implements OnInit {
	public loading = true;
	public projectId: string = '';

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _activepiecesService: ActivepiecesService,
		private readonly _toastrService: ToastrService,
		private readonly _store: Store,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._handleCallback();
	}

	private _handleCallback() {
		const { code, state } = this._route.snapshot.queryParams;

		if (!code || !state) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.INVALID_CALLBACK'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			this._redirectToIntegrations();
			return;
		}

		this.loading = true;

		// Step 1: Exchange code for access token
		this._activepiecesService
			.exchangeToken({ code, state })
			.pipe(
				tap((tokenResponse) => {
					console.log('Token exchange successful', tokenResponse);
				}),
				// Step 2: Get organization and tenant info
				switchMap((tokenResponse) => {
					return this._store.selectedOrganization$.pipe(
						tap((organization) => {
							if (!organization) {
								throw new Error('No organization selected');
							}
						}),
						switchMap((organization) => {
							// Ask user for project ID or use a default one
							// For now, we'll show a prompt
							this.projectId = prompt(
								this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.PROMPTS.PROJECT_ID'),
								''
							);

							if (!this.projectId) {
								throw new Error('Project ID is required');
							}

							// Step 3: Create connection with the access token
							return this._activepiecesService.upsertConnection({
								accessToken: tokenResponse.access_token,
								projectId: this.projectId,
								tenantId: organization.tenantId,
								organizationId: organization.id
							});
						})
					);
				}),
				tap((connection) => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.SUCCESS.CONNECTION_CREATED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					console.log('Connection created successfully', connection);
					this._redirectToIntegrations();
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.ERRORS.CALLBACK_FAILED'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error handling callback:', error);
					this._redirectToIntegrations();
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _redirectToIntegrations() {
		this._router.navigate(['/pages/integrations']);
	}
}
