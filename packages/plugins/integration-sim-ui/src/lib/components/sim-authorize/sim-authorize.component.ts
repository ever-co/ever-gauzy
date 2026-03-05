import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap, take } from 'rxjs';
import { IntegrationEnum, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { IntegrationsService, SimService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
const INTEGRATION_SIM_PAGE_LINK = '/pages/integrations/sim';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-sim-authorize',
	templateUrl: './sim-authorize.component.html',
	styleUrls: ['./sim-authorize.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimAuthorizeComponent extends TranslationBaseComponent implements OnInit {
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _store = inject(Store);
	private readonly _simService = inject(SimService);
	private readonly _integrationsService = inject(IntegrationsService);

	readonly organization = signal<IOrganization | null>(null);
	readonly loading = signal<boolean>(false);

	form: UntypedFormGroup = new UntypedFormGroup({
		api_key: new UntypedFormControl('', [Validators.required, Validators.pattern(/\S+/)])
	});

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		const routeData = this._activatedRoute.snapshot.data;
		const shouldCheckRememberState = routeData?.['state'] === true;

		this._store.selectedOrganization$
			.pipe(
				filter((org): org is IOrganization => !!org),
				tap((org) => {
					this.organization.set(org);
					if (shouldCheckRememberState) {
						this._checkRememberState(org);
					}
				}),
				shouldCheckRememberState ? take(1) : tap(),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Check if SIM integration is already configured for this tenant.
	 * If so, auto-redirect to the integration dashboard.
	 */
	private _checkRememberState(org: IOrganization): void {
		this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.SIM,
				organizationId: org.id
			})
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (integration: IIntegrationTenant) => {
					if (integration?.id) {
						this._router.navigate([INTEGRATION_SIM_PAGE_LINK, integration.id]);
					}
				},
				error: () => {
					// No existing integration found — stay on authorize page
				}
			});
	}

	/**
	 * Submit the API key to configure SIM integration.
	 */
	setupApiKey(): void {
		if (this.form.invalid || this.loading()) return;

		const apiKey = this.form.get('api_key')?.value?.trim();
		const organizationId = this.organization()?.id;

		if (!apiKey || !organizationId) {
			this.loading.set(false);
			return;
		}

		this.loading.set(true);
		this._simService.setup(apiKey, organizationId).pipe(untilDestroyed(this)).subscribe({
			next: (result) => {
				this.loading.set(false);
				this._router.navigate([INTEGRATION_SIM_PAGE_LINK, result.integrationTenantId]);
			},
			error: () => {
				this.loading.set(false);
			}
		});
	}
}
