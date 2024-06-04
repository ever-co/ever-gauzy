import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { UntypedFormGroup, UntypedFormBuilder, Validators, FormGroupDirective, FormControl } from '@angular/forms';
import { EMPTY } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HttpStatus, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, ToastrService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import { GauzyAIService } from '@gauzy/ui-sdk/core';
import { ReplacePipe } from './../../../../../@shared/pipes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-gauzy-ai-authorization',
	templateUrl: './authorization.component.html',
	styleUrls: ['./authorization.component.scss'],
	providers: []
})
export class GauzyAIAuthorizationComponent implements AfterViewInit, OnInit, OnDestroy {
	public organization: IOrganization;

	/**
	 * The form property is a readonly FormGroup that is built using the buildForm static method.
	 */
	readonly form: UntypedFormGroup = GauzyAIAuthorizationComponent.buildForm(this._formBuilder);

	/**
	 * Static method to build the Angular FormGroup using the FormBuilder.
	 * @param fb The FormBuilder instance used to build the form.
	 * @returns A FormGroup containing form controls for client_id, client_secret, and openai_api_secret_key.
	 */
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			apiKey: [null, Validators.required],
			apiSecret: [null, Validators.required],
			openAiSecretKey: [null],
			openAiOrganizationId: [null]
		});
	}

	// Using @ViewChild to get a reference to the FormGroupDirective with the template reference variable 'formDirective'
	@ViewChild('formDirective') formDirective: FormGroupDirective;

	constructor(
		private readonly _formBuilder: UntypedFormBuilder,
		private readonly _router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _store: Store,
		private readonly _gauzyAIService: GauzyAIService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _replacePipe: ReplacePipe
	) {}

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

	ngAfterViewInit(): void {
		/**
		 * Get references to the 'openAiSecretKey' and 'openAiOrganizationId' form controls.
		 */
		const openAiSecretKey = <FormControl>this.form.get('openAiSecretKey');
		const openAiOrganizationId = <FormControl>this.form.get('openAiOrganizationId');

		// Subscribe to changes in the 'openAiSecretKey' form control value.
		openAiSecretKey.valueChanges.subscribe((value) => {
			// Check if 'openAiSecretKey' has a value.
			if (value) {
				// If 'openAiSecretKey' has a value, set 'Validators.required' on 'openAiOrganizationId'.
				openAiOrganizationId.setValidators([Validators.required]);
			} else {
				// If 'openAiSecretKey' does not have a value, remove validators from 'openAiOrganizationId'.
				openAiOrganizationId.setValidators(null);
			}

			// Update the validation status of 'openAiOrganizationId'.
			openAiOrganizationId.updateValueAndValidity();
		});
	}

	ngOnDestroy(): void {}

	/**
	 * Gauzy AI integration remember state API call
	 */
	private _redirectToGauzyAIIntegration(integrationId: string) {
		this._router.navigate(['pages/integrations/gauzy-ai', integrationId]);
	}

	/**
	 * Handles the form submission for creating a new integration.
	 * @returns {Promise<void>} A promise indicating the success or failure of the submission.
	 */
	async onSubmit(): Promise<void> {
		try {
			// Check if the organization is available and the form is valid
			if (!this.organization || this.form.invalid) {
				return;
			}

			// Extract values from the form
			const { apiKey, apiSecret, openAiSecretKey, openAiOrganizationId } = this.form.value;

			// Extract values from the organization
			const { id: organizationId, tenantId, name: organizationName } = this.organization;

			// Create a new integration using the provided values
			this._gauzyAIService
				.create({
					apiKey,
					apiSecret,
					openAiSecretKey,
					openAiOrganizationId,
					organizationId,
					tenantId
				})
				.pipe(
					tap((response: any) => {
						if (response['status'] == HttpStatus.BAD_REQUEST) {
							throw new Error(`${response['message']}`);
						}
					}),
					// Perform actions after the integration creation
					tap((integration: IIntegrationTenant) => {
						if (!!integration) {
							// Transform integration name for display
							const provider = this._replacePipe.transform(integration?.name, '_', ' ');

							// Display success message
							this._toastrService.success(`INTEGRATIONS.MESSAGE.INTEGRATION_ADDED`, {
								provider,
								organization: organizationName
							});
						}
					}),
					// Redirect to the Gauzy AI integration after creation
					tap((integration: IIntegrationTenant) => {
						this._redirectToGauzyAIIntegration(integration.id);
					}),
					// Catch and handle errors
					catchError((error) => {
						// Handle and log errors using the _errorHandlingService
						this._errorHandlingService.handleError(error);
						// Return an empty observable to continue the stream
						return EMPTY;
					}),
					// Unsubscribe when the component is destroyed
					untilDestroyed(this)
				)
				.subscribe();
		} catch (error) {
			// Log any errors that occur during the process
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
