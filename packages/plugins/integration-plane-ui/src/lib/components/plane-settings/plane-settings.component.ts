import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, switchMap, tap } from 'rxjs';
import { IOrganization } from '@gauzy/contracts';
import { IPlaneRegenerateKeyResponse, PlaneService, IPlaneSettingsResponse, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { INTEGRATION_PLANE_PAGE_LINK } from '../../integration-plane.routes';
import { PlaneApiKeyDialogComponent } from '../api-key-dialog/api-key-dialog.component';

const URL_PATTERN = /^https?:\/\/.+/;

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-plane-settings',
	templateUrl: './plane-settings.component.html',
	styleUrls: ['./plane-settings.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaneSettingsComponent extends TranslationBaseComponent implements OnInit {
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _store = inject(Store);
	private readonly _planeService = inject(PlaneService);
	private readonly _dialogService = inject(NbDialogService);

	readonly organization = signal<IOrganization | null>(null);
	readonly integrationTenantId = signal<string | null>(null);
	readonly loading = signal<boolean>(false);
	readonly saving = signal<boolean>(false);
	readonly settings = signal<IPlaneSettingsResponse | null>(null);
	readonly isEditing = signal<boolean>(false);

	form = new FormGroup({
		planeWebUrl: new FormControl('', [Validators.required, Validators.pattern(URL_PATTERN)]),
		planeAdminUrl: new FormControl('', [Validators.pattern(URL_PATTERN)]),
		planeSpaceUrl: new FormControl('', [Validators.pattern(URL_PATTERN)])
	});

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		// Extract integration tenant ID from route
		this._activatedRoute.params
			.pipe(
				filter((params) => !!params['id']),
				tap((params) => this.integrationTenantId.set(params['id'])),
				untilDestroyed(this)
			)
			.subscribe();

		// Load settings when organization is available
		this._store.selectedOrganization$
			.pipe(
				filter((org): org is IOrganization => !!org),
				tap((org) => this.organization.set(org)),
				switchMap((org) => {
					this.loading.set(true);
					return this._planeService.getSettings(org.id);
				}),
				tap((settings: IPlaneSettingsResponse) => {
					this.settings.set(settings);
					this._patchForm(settings);
					this.loading.set(false);
				}),
				untilDestroyed(this)
			)
			.subscribe({
				error: () => {
					this.loading.set(false);
					this._router.navigate([INTEGRATION_PLANE_PAGE_LINK]);
				}
			});
	}

	/**
	 * Toggle edit mode.
	 */
	toggleEdit(): void {
		if (this.isEditing()) {
			// Cancel: revert form to current settings
			const current = this.settings();
			if (current) {
				this._patchForm(current);
			}
		}
		this.isEditing.update((v) => !v);
	}

	/**
	 * Save updated settings.
	 */
	saveSettings(): void {
		if (this.form.invalid || this.saving()) return;

		const organizationId = this.organization()?.id;
		if (!organizationId) return;

		const planeWebUrl = this.form.get('planeWebUrl')?.value?.trim();
		const planeAdminUrl = this.form.get('planeAdminUrl')?.value?.trim() || undefined;
		const planeSpaceUrl = this.form.get('planeSpaceUrl')?.value?.trim() || undefined;

		if (!planeWebUrl) return;

		this.saving.set(true);
		this._planeService
			.updateSettings({ planeWebUrl, planeAdminUrl, planeSpaceUrl }, organizationId)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: () => {
					this.saving.set(false);
					this.isEditing.set(false);
					// Refresh settings
					this._refreshSettings();
				},
				error: () => {
					this.saving.set(false);
				}
			});
	}

	/**
	 * Remove the Plane integration.
	 */
	removeIntegration(): void {
		const tenantId = this.integrationTenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this._planeService
			.removeIntegration(tenantId)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: () => {
					this.loading.set(false);
					this._router.navigate([INTEGRATION_PLANE_PAGE_LINK]);
				},
				error: () => {
					this.loading.set(false);
				}
			});
	}

	/**
	 * Regenerate API key.
	 */
	regenerateKey(): void {
		const organizationId = this.organization()?.id;
		if (!organizationId) return;

		this.loading.set(true);
		this._planeService
			.regenerateApiKey(organizationId)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (result: IPlaneRegenerateKeyResponse) => {
					this.loading.set(false);
					this._showApiKeyDialog(result.apiKey, result.apiSecret);
				},
				error: () => {
					this.loading.set(false);
				}
			});
	}

	private _patchForm(settings: IPlaneSettingsResponse): void {
		this.form.patchValue({
			planeWebUrl: settings.planeWebUrl || '',
			planeAdminUrl: settings.planeAdminUrl || '',
			planeSpaceUrl: settings.planeSpaceUrl || ''
		});
	}

	private _showApiKeyDialog(apiKey: string, apiSecret: string): void {
		const dialogRef = this._dialogService.open(PlaneApiKeyDialogComponent, {
			closeOnBackdropClick: false,
			closeOnEsc: false
		});

		dialogRef.componentRef.instance.apiKey = apiKey;
		dialogRef.componentRef.instance.apiSecret = apiSecret;
	}

	private _refreshSettings(): void {
		const organizationId = this.organization()?.id;
		if (!organizationId) return;

		this._planeService
			.getSettings(organizationId)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (settings) => {
					this.settings.set(settings);
					this._patchForm(settings);
				}
			});
	}
}
