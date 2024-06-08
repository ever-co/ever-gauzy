import { AfterViewInit, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { EMPTY, Observable, catchError } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import {
	HttpStatus,
	IEntitySettingToSync,
	IIntegrationTenant,
	IntegrationEntity,
	IntegrationEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { ErrorHandlingService, ToastrService } from '@gauzy/ui-sdk/core';
import { IntegrationEntitySettingService, IntegrationEntitySettingServiceStoreService } from '@gauzy/ui-sdk/core';

@UntilDestroy()
@Component({
	selector: 'ngx-github-settings',
	templateUrl: './settings.component.html',
	styleUrls: ['./settings.component.scss']
})
export class GithubSettingsComponent extends TranslationBaseComponent implements OnInit, AfterViewInit {
	// Define a public property 'IntegrationEntity' that appears to be an enum.
	public IntegrationEntity = IntegrationEntity;

	// Define a public property 'loading' of type boolean to track loading state.
	public loading: boolean;

	// Define a public property 'entitiesToSync$' of type Observable<IEntitySettingToSync>.
	// It's initialized with a property from '_integrationsService', possibly an observable.
	public entitiesToSync$: Observable<IEntitySettingToSync> =
		this._integrationEntitySettingServiceStoreService.entitiesToSync$;

	// Define a private property to hold the integration tenant
	private _integration: IIntegrationTenant;
	// Define a getter to retrieve the integration tenant
	get integration(): IIntegrationTenant {
		return this._integration;
	}
	// Define an @Input setter to set the integration tenant from external sources
	@Input() set integration(value: IIntegrationTenant) {
		// Set the private integration tenant property when the value is provided
		this._integration = value;
	}

	/**
	 *
	 */
	@Output() canceled = new EventEmitter<MouseEvent>();

	constructor(
		public readonly _translateService: TranslateService,
		private readonly _cdRef: ChangeDetectorRef,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _integrationEntitySettingService: IntegrationEntitySettingService,
		private readonly _integrationEntitySettingServiceStoreService: IntegrationEntitySettingServiceStoreService
	) {
		super(_translateService);
	}

	ngOnInit(): void {
		this.getEntitySettings();
	}

	ngAfterViewInit(): void {
		// Trigger change detection to update the view
		this._cdRef.detectChanges();
	}

	/**
	 * Fetch entity settings for a given integration.
	 */
	getEntitySettings() {
		// Check if the 'integration' object is falsy and return early if it is
		if (!this.integration) {
			return;
		}

		// Set the 'loading' flag to true to indicate that data is being loaded
		this.loading = true;

		// Extract the 'id' property from the 'integration' object
		const { id: integrationId } = this.integration;

		// Fetch entity settings by integration ID and handle the result as an observable
		this._integrationEntitySettingService
			.getEntitySettings(integrationId)
			.pipe(
				// Map the result to the desired format using '_setSettingsValue' function
				map(({ items }) => this._integrationEntitySettingServiceStoreService.setEntitySettingsValue(items)),

				// Execute the following code block when the observable completes or errors
				finalize(() => (this.loading = false)),

				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Saves the integration settings if the 'integration' object is defined.
	 *
	 * @returns
	 */
	saveIntegrationSettings() {
		// Check if the 'integration' object is falsy and return early if it is
		if (!this.integration) {
			return;
		}

		// Extract the 'id' property from the 'integration' object
		const { id: integrationId } = this.integration;

		// Use try-catch for better error handling
		try {
			// Retrieve the current settings from the service
			const { currentValue: settings }: IEntitySettingToSync =
				this._integrationEntitySettingServiceStoreService.getEntitySettingsValue();

			// Set the 'loading' flag to true to indicate that data is being loaded
			this.loading = true;

			// Update entity settings if needed
			this._integrationEntitySettingService
				.updateEntitySettings(integrationId, settings)
				.pipe(
					tap((response: any) => {
						if (response['status'] == HttpStatus.BAD_REQUEST) {
							throw new Error(`${response['message']}`);
						}
					}),
					tap(() => {
						// Display a success message
						this._toastrService.success(
							this.getTranslation('INTEGRATIONS.MESSAGE.SETTINGS_UPDATED', {
								provider: IntegrationEnum.GITHUB
							}),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
					}),
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Execute the following code block when the observable completes or errors
					finalize(() => (this.loading = false)),
					// Automatically unsubscribe when the component is destroyed
					untilDestroyed(this)
				)
				.subscribe();
			// Optionally, you can provide feedback or handle success here
		} catch (error) {
			// Handle errors (e.g., display an error message or log the error)
			console.error('Error updating entity settings:', error);

			// Optionally, you can provide error feedback to the user
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 *
	 */
	cancel($event: MouseEvent) {
		this.canceled.emit($event);
	}
}
