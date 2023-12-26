import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { UntypedFormGroup, UntypedFormBuilder, Validators, FormGroupDirective } from '@angular/forms';
import { EMPTY } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HttpStatus, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, GauzyAIService, Store, ToastrService } from './../../../../../@core/services';
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
	readonly form: FormGroup = GauzyAIAuthorizationComponent.buildForm(this._formBuilder);

	/**
	 * Static method to build the Angular FormGroup using the FormBuilder.
	 * @param fb The FormBuilder instance used to build the form.
	 * @returns A FormGroup containing form controls for client_id, client_secret, and openai_api_secret_key.
	 */
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			client_id: [null, Validators.required],
			client_secret: [null, Validators.required],
			openai_api_secret_key: [null]
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
	) { }

	/**
	 *
	 */
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
	}

	/**
	 *
	 */
	ngAfterViewInit(): void {
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
			const { client_id, client_secret, openai_api_secret_key } = this.form.value;

			// Extract values from the organization
			const { id: organizationId, tenantId, name: organizationName } = this.organization;

			// Create a new integration using the provided values
			this._gauzyAIService.create({
				client_id,
				client_secret,
				openai_api_secret_key,
				organizationId,
				tenantId
			}).pipe(
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
					// this.formDirective.reset();
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
			).subscribe();
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
