import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { tap, filter, catchError, map, distinctUntilChanged } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IIntegrationTenant, IOrganization, IntegrationEnum } from '@gauzy/contracts';
import {
	ActivepiecesService,
	IntegrationsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-activepieces-authorize',
	templateUrl: './activepieces-authorize.component.html',
	styleUrls: ['./activepieces-authorize.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivepiecesAuthorizeComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public readonly rememberState = signal(false);
	public readonly organization = signal<IOrganization | undefined>(undefined);
	public readonly loading = signal(false);

	readonly form: UntypedFormGroup = ActivepiecesAuthorizeComponent.buildForm(this._fb);

	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			api_key: [null, [Validators.required, Validators.pattern(/\S/)]]
		});
	}

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _activepiecesService: ActivepiecesService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		readonly _store: Store,
		private readonly _integrationsService: IntegrationsService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization.set(organization)),
				tap(() => this._checkRememberState()),
				untilDestroyed(this)
			)
			.subscribe();

		this._activatedRoute.data
			.pipe(
				map(({ state }) => !!state),
				distinctUntilChanged(),
				tap((state) => this.rememberState.set(state)),
				tap(() => this._checkRememberState()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * ActivePieces integration remember state API call
	 */
	private _checkRememberState() {
		const organization = this.organization();
		if (!organization || !this.rememberState()) {
			return;
		}

		const { id: organizationId, tenantId } = organization;
		this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.ACTIVE_PIECES,
				organizationId,
				tenantId
			})
			.pipe(
				filter((integration: IIntegrationTenant) => !!integration && !!integration.id),
				tap((integration: IIntegrationTenant) => {
					this._redirectToActivepiecesIntegration(integration.id);
				}),
				catchError((error) => {
					console.error('Failed to check remember state:', error);
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.AUTHORIZE.ERRORS.CHECK_REMEMBER_STATE')
					);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Submit API key to set up ActivePieces integration
	 */
	setupApiKey() {
		const organization = this.organization();
		if (this.form.invalid || !organization) {
			this._toastrService.error(this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.AUTHORIZE.ERRORS.INVALID_FORM'));
			return;
		}

		this.loading.set(true);
		const { id: organizationId } = organization;
		const apiKey = (this.form.value?.api_key ?? '').trim();

		this._activepiecesService
			.setup(apiKey, organizationId)
			.pipe(
				tap((response) => {
					this._toastrService.success(this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.AUTHORIZE.SUCCESS.SETTINGS_SAVED'));
					this.loading.set(false);
					this._redirectToActivepiecesIntegration(response.integrationTenantId);
				}),
				catchError((error) => {
					console.error('Failed to set up API key:', error);
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ACTIVEPIECES_PAGE.AUTHORIZE.ERRORS.SAVE_SETTINGS')
					);
					this.loading.set(false);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Redirect to ActivePieces integration page
	 */
	private _redirectToActivepiecesIntegration(integrationId: string) {
		this._router.navigate(['/pages/integrations/activepieces', integrationId], { replaceUrl: true });
	}

	ngOnDestroy(): void {}
}
