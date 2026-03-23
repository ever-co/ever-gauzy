import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap, take } from 'rxjs';
import { IntegrationEnum, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { IntegrationsService, IPlaneSetupResponse, PlaneService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { INTEGRATION_PLANE_PAGE_LINK } from '../../integration-plane.routes';
import { PlaneApiKeyDialogComponent } from '../api-key-dialog/api-key-dialog.component';

const URL_PATTERN = /^https?:\/\/.+/;

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-plane-authorize',
	templateUrl: './plane-authorize.component.html',
	styleUrls: ['./plane-authorize.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaneAuthorizeComponent extends TranslationBaseComponent implements OnInit {
	private readonly _location = inject(Location);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _store = inject(Store);
	private readonly _planeService = inject(PlaneService);
	private readonly _integrationsService = inject(IntegrationsService);
	private readonly _dialogService = inject(NbDialogService);

	readonly organization = signal<IOrganization | null>(null);
	readonly loading = signal<boolean>(false);

	form = new FormGroup({
		planeWebUrl: new FormControl('', [Validators.required, Validators.pattern(URL_PATTERN)]),
		planeAdminUrl: new FormControl('', [Validators.pattern(URL_PATTERN)]),
		planeSpaceUrl: new FormControl('', [Validators.pattern(URL_PATTERN)])
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
	 * Check if Plane integration is already configured for this tenant.
	 * If so, auto-redirect to the integration settings page.
	 */
	private _checkRememberState(org: IOrganization): void {
		this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.PLANE,
				organizationId: org.id
			})
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (integration: IIntegrationTenant) => {
					if (integration?.id) {
						this._router.navigate([INTEGRATION_PLANE_PAGE_LINK, integration.id]);
					}
				},
				error: (error: HttpErrorResponse) => {
					if (error.status === 404 || error.message?.includes('not found')) {
						return;
					}
					console.error('Failed to check Plane integration state:', error);
				}
			});
	}

	goBack(): void {
		this._location.back();
	}

	/**
	 * Submit the Plane URLs to configure the integration.
	 */
	setupPlane(): void {
		if (this.form.invalid || this.loading()) return;

		const planeWebUrl = this.form.get('planeWebUrl')?.value?.trim();
		const planeAdminUrl = this.form.get('planeAdminUrl')?.value?.trim();
		const planeSpaceUrl = this.form.get('planeSpaceUrl')?.value?.trim();
		const organizationId = this.organization()?.id;

		if (!planeWebUrl || !organizationId) {
			this.loading.set(false);
			return;
		}

		// Build DTO excluding empty optional fields to avoid @IsUrl validation failures
		const dto: { planeWebUrl: string; planeAdminUrl?: string; planeSpaceUrl?: string } = { planeWebUrl };
		if (planeAdminUrl) dto.planeAdminUrl = planeAdminUrl;
		if (planeSpaceUrl) dto.planeSpaceUrl = planeSpaceUrl;

		this.loading.set(true);
		this._planeService
			.setup(dto, organizationId)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (result: IPlaneSetupResponse) => {
					this.loading.set(false);
					this._showApiKeyDialog(result.apiKey, result.apiSecret, result.integrationTenantId);
				},
				error: () => {
					this.loading.set(false);
				}
			});
	}

	/**
	 * Show the API key dialog, then navigate to settings on close.
	 */
	private _showApiKeyDialog(apiKey: string, apiSecret: string, integrationTenantId: string): void {
		const dialogRef = this._dialogService.open(PlaneApiKeyDialogComponent, {
			closeOnBackdropClick: false,
			closeOnEsc: false
		});

		dialogRef.componentRef.instance.apiKey = apiKey;
		dialogRef.componentRef.instance.apiSecret = apiSecret;

		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe(() => {
			this._router.navigate([INTEGRATION_PLANE_PAGE_LINK, integrationTenantId]);
		});
	}
}
