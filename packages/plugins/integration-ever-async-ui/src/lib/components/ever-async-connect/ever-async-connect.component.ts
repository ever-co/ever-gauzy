import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs';
import { IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	EverAsyncService,
	IEverAsyncSetupResponse,
	IEverAsyncVerifyResponse
} from '../../services/ever-async.service';

const URL_PATTERN = /^https?:\/\/.+/;

/**
 * Connect wizard for the Ever Async integration:
 * paste the Ever Async server URL + API token, test the connection
 * (`/healthz` ping via the Gauzy API), then save.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-ever-async-connect',
	templateUrl: './ever-async-connect.component.html',
	styleUrls: ['./ever-async-connect.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EverAsyncConnectComponent extends TranslationBaseComponent implements OnInit {
	private readonly _location = inject(Location);
	private readonly _router = inject(Router);
	private readonly _store = inject(Store);
	private readonly _everAsyncService = inject(EverAsyncService);
	private readonly _toastrService = inject(ToastrService);
	private readonly _errorHandlingService = inject(ErrorHandlingService);

	readonly organization = signal<IOrganization | null>(null);
	readonly loading = signal<boolean>(false);
	readonly verifying = signal<boolean>(false);
	/** null = not tested yet; true/false = last test-connection outcome. */
	readonly connectionOk = signal<boolean | null>(null);

	form = new FormGroup({
		serverUrl: new FormControl('', [Validators.required, Validators.pattern(URL_PATTERN)]),
		apiToken: new FormControl('', [Validators.required])
	});

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		this._store.selectedOrganization$
			.pipe(
				filter((org): org is IOrganization => !!org),
				tap((org) => this.organization.set(org)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	goBack(): void {
		this._location.back();
	}

	/**
	 * Ping the Ever Async server's /healthz endpoint (via the Gauzy API)
	 * without saving anything.
	 */
	testConnection(): void {
		if (this.verifying()) return;

		const serverUrl = this.form.get('serverUrl')?.value?.trim() ?? '';
		if (!serverUrl || !URL_PATTERN.test(serverUrl)) {
			this.form.get('serverUrl')?.markAsTouched();
			return;
		}

		this.verifying.set(true);
		this.connectionOk.set(null);

		this._everAsyncService
			.verify(serverUrl)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (result: IEverAsyncVerifyResponse) => {
					this.verifying.set(false);
					this.connectionOk.set(result.ok);
					this._toastrService.success(this.getTranslation('INTEGRATIONS.EVER_ASYNC_PAGE.CONNECTION_OK'));
				},
				error: (error: HttpErrorResponse) => {
					this.verifying.set(false);
					this.connectionOk.set(false);
					this._toastrService.danger(this.getTranslation('INTEGRATIONS.EVER_ASYNC_PAGE.CONNECTION_FAILED'));
					this._errorHandlingService.handleError(error);
				}
			});
	}

	/**
	 * Save the connection: server URL + write-only API token.
	 * User mappings are managed later from the settings page (scaffold: the
	 * mapping table component is a follow-up, see the integration contract).
	 */
	connect(): void {
		if (this.loading()) return;

		const organizationId = this.organization()?.id;
		if (!organizationId) return;

		const serverUrl = this.form.get('serverUrl')?.value?.trim() ?? '';
		const apiToken = this.form.get('apiToken')?.value?.trim() ?? '';

		this.form.patchValue({ serverUrl, apiToken });
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		this.loading.set(true);

		this._everAsyncService
			.setup({ serverUrl, apiToken }, organizationId)
			.pipe(untilDestroyed(this))
			.subscribe({
				next: (_result: IEverAsyncSetupResponse) => {
					this.loading.set(false);
					this._toastrService.success(this.getTranslation('INTEGRATIONS.EVER_ASYNC_PAGE.CONNECTED'));
					this._router.navigate(['/pages/integrations']);
				},
				error: (error: HttpErrorResponse) => {
					this.loading.set(false);
					this._errorHandlingService.handleError(error);
				}
			});
	}
}
