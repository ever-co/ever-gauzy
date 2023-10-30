import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup, FormBuilder, Validators, FormGroupDirective } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IIntegrationSetting, IIntegrationTenant, IOrganization, IntegrationEnum } from '@gauzy/contracts';
import { GauzyAIService, IntegrationsService, Store } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-ai-authorize',
	templateUrl: './gauzy-ai-authorize.component.html',
	styleUrls: ['./gauzy-ai-authorize.component.scss'],
})
export class GauzyAIAuthorizeComponent implements AfterViewInit, OnInit, OnDestroy {

	@ViewChild('formDirective') formDirective: FormGroupDirective;

	readonly form: FormGroup = GauzyAIAuthorizeComponent.buildForm(this._formBuilder);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			client_id: [null, Validators.required],
			client_secret: [null, Validators.required],
		});
	}

	public organization: IOrganization;

	constructor(
		private readonly _formBuilder: FormBuilder,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _gauzyAIService: GauzyAIService,
		private readonly _integrationsService: IntegrationsService
	) { }

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this._activatedRoute.params
			.pipe(
				filter((params) => !!params && !!params.id),
				tap(() => this.getIntegrationTenant()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this._activatedRoute.data
			.pipe(
				// if remember state is true
				filter(({ state }) => !!state && state === true),
				tap(() => this._checkRememberState()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void { }

	/**
	 *
	 */
	getIntegrationTenant() {
		const integrationId = this._activatedRoute.snapshot.paramMap.get('id');
		if (integrationId) {
			const integration$ = this._integrationsService.fetchIntegrationTenant(integrationId, {
				relations: ['settings']
			});
			integration$.pipe(
				filter((integration: IIntegrationTenant) => !!integration.id),
				tap(({ settings }: IIntegrationTenant) => {
					const apiKey = settings.find((setting: IIntegrationSetting) => setting.settingsName === 'apiKey').settingsValue;
					const apiSecret = settings.find((setting: IIntegrationSetting) => setting.settingsName === 'apiSecret').settingsValue;

					this.form.patchValue({
						client_id: apiKey,
						client_secret: apiSecret
					});
				}),
				untilDestroyed(this)
			).subscribe();
		}
	}

	/**
	 *
	 * @returns
	 */
	private _checkRememberState() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		const state$ = this._integrationsService.getIntegrationByOptions({
			name: IntegrationEnum.GAUZY_AI,
			organizationId,
			tenantId
		});
		state$.pipe(
			filter((integration: IIntegrationTenant) => !!integration.id),
			tap((integration: IIntegrationTenant) => {
				this._redirectToGauzyAIIntegration(integration.id);
			}),
			untilDestroyed(this)
		).subscribe();
	}

	/**
	 * Gauzy AI integration remember state API call
	 */
	private _redirectToGauzyAIIntegration(integrationId: string) {
		this._router.navigate(['pages/integrations/gauzy-ai', integrationId]);
	}

	/**
	 *
	 * @returns
	 */
	async onSubmit() {
		if (!this.organization || this.form.invalid) {
			return;
		}
		try {
			const { client_id, client_secret } = this.form.value;
			const { id: organizationId, tenantId } = this.organization;

			this._gauzyAIService.addIntegration({
				client_id,
				client_secret,
				organizationId,
				tenantId
			}).pipe(
				tap((integration: IIntegrationTenant) => {
					this._redirectToGauzyAIIntegration(integration.id);
				}),
				untilDestroyed(this)
			).subscribe();
		} catch (error) {
			console.log('Error while creating new integration for Gauzy AI', error);
		}
	}

	/**
	 * Navigate to the "Integrations" page.
	 */
	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}
}
