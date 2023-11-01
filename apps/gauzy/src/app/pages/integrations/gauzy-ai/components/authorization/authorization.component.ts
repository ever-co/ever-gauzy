import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { FormGroup, FormBuilder, Validators, FormGroupDirective } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { GauzyAIService, Store } from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-ai-authorization',
	templateUrl: './authorization.component.html',
	styleUrls: ['./authorization.component.scss'],
})
export class GauzyAIAuthorizationComponent implements OnInit, OnDestroy {

	public organization: IOrganization;

	readonly form: FormGroup = GauzyAIAuthorizationComponent.buildForm(this._formBuilder);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			client_id: [null, Validators.required],
			client_secret: [null, Validators.required],
		});
	}

	@ViewChild('formDirective') formDirective: FormGroupDirective;

	constructor(
		private readonly _formBuilder: FormBuilder,
		private readonly _router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _store: Store,
		private readonly _gauzyAIService: GauzyAIService
	) { }

	ngOnInit(): void {
		this._activatedRoute.data
			.pipe(
				tap(({ integration }: Data) => {
					if (integration) {
						this._redirectToGauzyAIIntegration(integration.id);
					}
				}),
				untilDestroyed(this) // Ensure that subscriptions are automatically unsubscribed on component destruction.
			)
			.subscribe();
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void { }

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
