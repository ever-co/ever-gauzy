import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import { Observable, finalize } from 'rxjs';
import { map } from 'rxjs/operators';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEntitySettingToSync, IIntegrationTenant, IntegrationEntity } from '@gauzy/contracts';
import { IntegrationEntitySettingService, IntegrationEntitySettingServiceStoreService } from './../../../../../@core/services';

@UntilDestroy()
@Component({
	selector: 'ngx-github-settings-dialog',
	templateUrl: './settings-dialog.component.html',
	styleUrls: ['./settings-dialog.component.scss']
})
export class GithubSettingsDialogComponent implements OnInit, AfterViewInit {

	// Define a public property 'IntegrationEntity' that appears to be an enum.
	public IntegrationEntity = IntegrationEntity;

	// Define a public property 'loading' of type boolean to track loading state.
	public loading: boolean;

	// Define a public property 'entitiesToSync$' of type Observable<IEntitySettingToSync>.
	// It's initialized with a property from '_integrationsService', possibly an observable.
	public entitiesToSync$: Observable<IEntitySettingToSync> = this._integrationEntitySettingServiceStoreService.entitiesToSync$;

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

	constructor(
		public readonly dialogRef: NbDialogRef<GithubSettingsDialogComponent>,
		private readonly _cdRef: ChangeDetectorRef,
		private readonly _integrationEntitySettingService: IntegrationEntitySettingService,
		private readonly _integrationEntitySettingServiceStoreService: IntegrationEntitySettingServiceStoreService,
	) { }

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
		this._integrationEntitySettingService.getEntitySettings(integrationId).pipe(
			// Map the result to the desired format using '_setSettingsValue' function
			map(({ items }) => this._integrationEntitySettingServiceStoreService.setEntitySettingsValue(items)),

			// Execute the following code block when the observable completes or errors
			finalize(() => {
				// Set the 'loading' flag to false to indicate that data loading is complete
				this.loading = false;
			}),

			// Automatically unsubscribe when the component is destroyed
			untilDestroyed(this)
		).subscribe();
	}
}
