import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { catchError, EMPTY, filter, switchMap, tap } from 'rxjs';
import { IOrganization } from '@gauzy/contracts';
import {
	ErrorHandlingService,
	IPlaneRegenerateKeyResponse,
	PlaneService,
	IPlaneSettingsResponse,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { INTEGRATION_PLANE_PAGE_LINK } from '../../integration-plane.routes';
import { PlaneApiKeyDialogComponent } from '../api-key-dialog/api-key-dialog.component';

const URL_PATTERN = /^https?:\/\/.+/;

/** Default global hosted Ever Gauzy PM web URL used for SSO in shared mode. */
const SHARED_PLANE_WEB_URL = 'https://pm.gauzy.co';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-plane-settings',
	templateUrl: './plane-settings.component.html',
	styleUrls: ['./plane-settings.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaneSettingsComponent extends TranslationBaseComponent implements OnInit {
	private readonly _location = inject(Location);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _store = inject(Store);
	private readonly _planeService = inject(PlaneService);
	private readonly _dialogService = inject(NbDialogService);
	private readonly _toastrService = inject(ToastrService);
	private readonly _errorHandlingService = inject(ErrorHandlingService);

	readonly organization = signal<IOrganization | null>(null);
	readonly integrationTenantId = signal<string | null>(null);
	readonly loading = signal<boolean>(false);
	readonly saving = signal<boolean>(false);
	readonly settings = signal<IPlaneSettingsResponse | null>(null);
	readonly isEditing = signal<boolean>(false);
	/** True when a settings load failed (non-404), so the UI shows an error/retry
	 * state instead of rendering a misleading empty shared-mode page. */
	readonly loadFailed = signal<boolean>(false);

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
					return this._planeService.getSettings(org.id).pipe(
						catchError((error: HttpErrorResponse) => {
							this.loading.set(false);
							// Only bounce to the setup screen when the integration is
							// genuinely not configured (HTTP 404). A transient/5xx error is
							// surfaced and the user stays put, instead of a configured tenant
							// being silently kicked back to "set up Plane". Recover to EMPTY
							// so the outer organization stream stays alive and future org
							// switches still reload settings.
							if (error?.status === 404) {
								this._router.navigate([INTEGRATION_PLANE_PAGE_LINK]);
							} else {
								// Clear ALL loaded state (settings, form values, edit mode) so a
								// failed org switch doesn't leave the previous org's settings/URLs
								// on screen as a misleading "shared-mode" page, then surface the
								// error.
								this.settings.set(null);
								this.isEditing.set(false);
								this.loadFailed.set(true);
								this.form.reset({ planeWebUrl: '', planeAdminUrl: '', planeSpaceUrl: '' });
								this._errorHandlingService.handleError(error);
							}
							return EMPTY;
						})
					);
				}),
				tap((settings: IPlaneSettingsResponse) => {
					this.settings.set(settings);
					this._patchForm(settings);
					this.loadFailed.set(false);
					this.loading.set(false);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	goBack(): void {
		this._location.back();
	}

	/**
	 * Retry loading settings for the current organization after a failed load.
	 */
	retryLoad(): void {
		const organizationId = this.organization()?.id;
		if (!organizationId) return;

		this.loading.set(true);
		this._planeService
			.getSettings(organizationId)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (settings) => {
					this.loading.set(false);
					this.loadFailed.set(false);
					this.settings.set(settings);
					this._patchForm(settings);
				},
				error: (error: HttpErrorResponse) => {
					this.loading.set(false);
					if (error?.status === 404) {
						this._router.navigate([INTEGRATION_PLANE_PAGE_LINK]);
					} else {
						this.loadFailed.set(true);
						this._errorHandlingService.handleError(error);
					}
				}
			});
	}

	/**
	 * Current integration mode ('shared' | 'custom'), defaulting to 'shared'.
	 */
	get mode(): 'shared' | 'custom' {
		return this.settings()?.mode === 'custom' ? 'custom' : 'shared';
	}

	/**
	 * Open the Plane web app with one-click SSO using the Gauzy access token.
	 * Uses the configured web URL (or the global hosted PM URL for shared mode).
	 */
	openPlane(): void {
		const token = this._store.token;
		if (!token) {
			// Surface why nothing opened instead of a silent no-op.
			this._toastrService.warning('INTEGRATIONS.PLANE_PAGE.SESSION_EXPIRED');
			return;
		}

		const url = this.settings()?.planeWebUrl?.trim() || SHARED_PLANE_WEB_URL;
		window.open(`${url}/?sso=${token}`, '_blank');
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
		if (this.saving()) return;

		// Trim URL values before validation to prevent submitting
		// whitespace-padded strings that passed the pattern check untrimmed.
		const planeWebUrl = this.form.get('planeWebUrl')?.value?.trim() ?? '';
		const planeAdminUrl = this.form.get('planeAdminUrl')?.value?.trim() ?? '';
		const planeSpaceUrl = this.form.get('planeSpaceUrl')?.value?.trim() ?? '';

		this.form.patchValue({ planeWebUrl, planeAdminUrl, planeSpaceUrl });

		if (this.form.invalid) return;

		const organizationId = this.organization()?.id;
		if (!organizationId || !planeWebUrl) return;

		this.saving.set(true);
		this._planeService
			.updateSettings(
				{ planeWebUrl, planeAdminUrl: planeAdminUrl || undefined, planeSpaceUrl: planeSpaceUrl || undefined },
				organizationId
			)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: () => {
					this.saving.set(false);
					this.isEditing.set(false);
					this._toastrService.success('INTEGRATIONS.PLANE_PAGE.SETTINGS_SAVED');
					// Refresh settings
					this._refreshSettings();
				},
				error: (error: HttpErrorResponse) => {
					this.saving.set(false);
					this._errorHandlingService.handleError(error);
				}
			});
	}

	/**
	 * Remove the Plane integration after user confirmation.
	 */
	removeIntegration(): void {
		const tenantId = this.integrationTenantId();
		if (!tenantId) return;

		if (!window.confirm(this.translateService.instant('INTEGRATIONS.PLANE_PAGE.CONFIRM_DELETE'))) {
			return;
		}

		this.loading.set(true);
		this._planeService
			.removeIntegration(tenantId)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: () => {
					this.loading.set(false);
					this._toastrService.success('INTEGRATIONS.PLANE_PAGE.INTEGRATION_REMOVED');
					this._router.navigate([INTEGRATION_PLANE_PAGE_LINK]);
				},
				error: (error: HttpErrorResponse) => {
					this.loading.set(false);
					this._errorHandlingService.handleError(error);
				}
			});
	}

	/**
	 * Regenerate API key after user confirmation.
	 */
	regenerateKey(): void {
		const organizationId = this.organization()?.id;
		if (!organizationId) return;

		if (!window.confirm(this.translateService.instant('INTEGRATIONS.PLANE_PAGE.CONFIRM_REGENERATE'))) {
			return;
		}

		this.loading.set(true);
		this._planeService
			.regenerateApiKey(organizationId)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (result: IPlaneRegenerateKeyResponse) => {
					this.loading.set(false);
					this._showApiKeyDialog(result.apiKey, result.apiSecret);
				},
				error: (error: HttpErrorResponse) => {
					this.loading.set(false);
					this._errorHandlingService.handleError(error);
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
				},
				error: (error: HttpErrorResponse) => this._errorHandlingService.handleError(error)
			});
	}
}
