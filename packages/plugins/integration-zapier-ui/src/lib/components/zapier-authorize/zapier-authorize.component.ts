import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService, IntegrationsService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { ICreateZapierIntegrationInput, IntegrationEnum, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-authorize',
	templateUrl: './zapier-authorize.component.html',
	styleUrls: ['./zapier-authorize.component.scss'],
	standalone: false
})
export class ZapierAuthorizeComponent extends TranslationBaseComponent implements OnInit {
	public form: FormGroup;
	public loading = false;
	public oauthConfig: { clientId: string; redirectUri: string } = null;
	public organization: IOrganization;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._loadOrganization()
			.pipe(
				switchMap(() => this._checkExistingIntegration()),
				untilDestroyed(this)
			)
			.subscribe();
		this._loadOAuthConfig();
	}

	private _initializeForm() {
		this.form = this._fb.group({
			client_id: ['', [Validators.required]],
			client_secret: ['', [Validators.required]]
		});
	}

	private _loadOrganization() {
		return this._store.selectedOrganization$.pipe(
			tap((organization) => {
				this.organization = organization;
			})
		);
	}

	private _loadOAuthConfig() {
		this._zapierService
			.getOAuthConfig()
			.pipe(
				tap((config) => {
					this.oauthConfig = config;
				}),
				catchError((error) => {
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _checkExistingIntegration() {
		if (!this.organization) return EMPTY;

		const { id: organizationId, tenantId } = this.organization;

		return this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.ZAPIER,
				organizationId,
				tenantId
			})
			.pipe(
				tap((integration) => {
					if (integration) {
						this._router.navigate(['/pages/integrations/zapier', integration.id]);
					}
				}),
				catchError((error) => {
					console.error('Error checking existing integration:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				})
			);
	}

	/**
	 * Start OAuth authorization flow
	 */
	startAuthorization() {
		if (this.form.invalid) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.INVALID_FORM'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		if (!this.organization) {
			this.loading = false;
			return;
		}

		const credentials: ICreateZapierIntegrationInput = {
			...this.form.value,
			organizationId: this.organization.id
		};

		this._zapierService
			.initializeIntegration(credentials)
			.pipe(
				tap((response: { authorizationUrl: string }) => {
					window.location.href = response.authorizationUrl;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.START_AUTHORIZATION'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error starting authorization:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
