import { Component, OnInit, OnDestroy } from '@angular/core';
import { Validators, UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IIntegrationTenant, IOrganization, IntegrationEnum } from '@gauzy/contracts';
import { HubstaffService, IntegrationsService, Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-hubstaff-authorize',
	templateUrl: './hubstaff-authorize.component.html',
	styleUrls: ['./hubstaff-authorize.component.scss']
})
export class HubstaffAuthorizeComponent implements OnInit, OnDestroy {
	public hubStaffAuthorizeCode: string;
	public organization: IOrganization;
	public clientIdForm: UntypedFormGroup = this._fb.group({
		client_id: ['', Validators.required]
	});
	public clientSecretForm: UntypedFormGroup = this._fb.group({
		client_secret: ['', Validators.required],
		authorization_code: ['', Validators.required]
	});

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _hubstaffService: HubstaffService,
		private readonly _fb: UntypedFormBuilder,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService
	) {}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this._getHubstaffCode();
	}

	/**
	 * Retrieves the Hubstaff authorization code from the query parameters.
	 * If the code is present, it updates the client ID and authorization
	 * code in the respective forms. If the code is not available, it subscribes
	 * to route data to handle any remembered state.
	 */
	private _getHubstaffCode() {
		this._activatedRoute.queryParams
			.pipe(
				filter(({ code }) => !!code), // Ensure that a code is present
				tap(({ code, state }) => {
					this.hubStaffAuthorizeCode = code; // Set the authorization code
					this.clientIdForm.patchValue({ client_id: state }); // Patch the client ID
					this.clientSecretForm.patchValue({ authorization_code: code }); // Patch the authorization code
				}),
				untilDestroyed(this) // Automatically unsubscribes when the component is destroyed
			)
			.subscribe();

		// Subscribe to route data only if the authorize code is not set
		if (!this.hubStaffAuthorizeCode) {
			this.subscribeRouteData(); // Handle remembered state if no code
		}
	}

	/**
	 * Subscribes to the route data to check for a remembered state.
	 * If the state exists and is true, it checks the remembered state
	 * for the Hubstaff integration.
	 */
	private subscribeRouteData() {
		this._activatedRoute.data
			.pipe(
				filter(({ state }) => !!state && state === true), // Check if the state is true
				tap(() => this._checkRememberState()), // Call method to check remembered state
				untilDestroyed(this) // Automatically unsubscribes when the component is destroyed
			)
			.subscribe();
	}

	/**
	 * Checks the remembered state of the Hubstaff integration for the current organization.
	 * If an integration exists, it redirects to the Hubstaff integration page.
	 */
	private _checkRememberState() {
		// Early return if organization is not defined
		if (!this.organization) return;

		const { id: organizationId, tenantId } = this.organization;

		this._integrationsService
			.getIntegrationByOptions({
				name: IntegrationEnum.HUBSTAFF,
				organizationId,
				tenantId
			})
			.pipe(
				filter((integration: IIntegrationTenant) => !!integration.id), // Filter out integrations without an ID
				tap((integration: IIntegrationTenant) => this._redirectToHubstaffIntegration(integration.id)), // Redirect if a valid integration is found
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Hubstaff integration remember state API call
	 */
	private _redirectToHubstaffIntegration(integrationId: ID) {
		this._router.navigate(['pages/integrations/hubstaff', integrationId]);
	}

	/**
	 * Authorizes the Hubstaff client using the client ID provided in the form.
	 */
	authorizeHubstaff() {
		const client_id = this.clientIdForm.get('client_id')?.value;
		if (client_id) {
			this._hubstaffService.authorizeClient(client_id);
		}
	}

	/**
	 * Adds Hubstaff integration for the selected organization using client credentials and authorization code.
	 * Validates the necessary inputs before proceeding.
	 */
	addIntegration() {
		if (!this.organization) {
			return;
		}

		// Extract organizationId from the organization
		const { id: organizationId } = this.organization;

		// Extract client_secret and client_id from the form
		const client_secret = this.clientSecretForm.get('client_secret')?.value;
		const client_id = this.clientIdForm.get('client_id')?.value;

		if (client_secret && client_id && organizationId) {
			this._hubstaffService
				.addIntegration({
					code: this.hubStaffAuthorizeCode,
					client_secret,
					client_id,
					organizationId
				})
				.pipe(
					tap(({ id }) => this._redirectToHubstaffIntegration(id)),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	ngOnDestroy() {}
}
