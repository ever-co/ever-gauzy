import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubAppInstallInput, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { GithubService } from '../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './installation.component.html'
})
export class GithubInstallationComponent implements OnInit {

	public isLoading: boolean = true;
	public organization: IOrganization;

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _githubService: GithubService,
	) { }

	/**
	 * Initialize the component when it is created.
	 * This method sets up an observable subscription to listen for query parameters in the URL.
	 */
	ngOnInit(): void {
		this._route.queryParams
			.pipe(
				// Filter and keep only valid queryParams with 'code'
				filter(({ code }) => !!code),
				// Use 'tap' operator to perform an asynchronous action
				tap(async ({ code, state }: IGithubAppInstallInput) =>
					await this.verifyGitHubAppAuthorization({
						code,
						state
					})
				),
				// Use 'untilDestroyed' operator to automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			// Subscribe to the observable to start listening for query parameters
			.subscribe();
	}

	/**
	 * Verify GitHub application authorization and perform actions based on input parameters.
	 *
	 * @param input - An object containing input parameters, including 'installation_id', 'setup_action', and 'state'.
	 */
	private async verifyGitHubAppAuthorization(input: IGithubAppInstallInput) {
		const { code, state } = input;

		// Check if all required parameters are provided
		if (code && state) {
			try {
				// Split the 'state' parameter to extract 'organizationId' and 'tenantId'
				const [organizationId, tenantId] = state.split('|');

				// Call a service method (likely from _githubService) to add the installation app
				const integration = await this._githubService.addInstallationApp({
					code,
					organizationId,
					tenantId
				});

				// Simulate a success scenario, possibly updating the UI or performing other actions
				this.simulateSuccess(integration);
			} catch (error) {
				// Handle errors, such as failed GitHub app installation
				console.log('Error while failed to install GitHub app: %s', code);

				// Simulate an error scenario, possibly displaying an error message or taking corrective actions
				this.simulateError();
			}
		}
	}

	/**
	 * Simulate a successful scenario after GitHub app installation.
	 *
	 * @param integration - An object containing integration data.
	 */
	private simulateSuccess(integration: IIntegrationTenant) {
		// Create a custom success event with data
		const event = new CustomEvent('onSuccess', {
			detail: {
				...integration
			}
		});

		// Dispatch the success event to the parent window
		window.opener.dispatchEvent(event);

		// Log a message indicating that the popup window is closed after GitHub app installation
		console.log('Popup window closed after GitHub app installed!');

		// Delay navigation by 2 seconds before closing the window
		this.handleClosedPopupWindow(2000); // 2000 milliseconds (2 seconds)
	}

	/**
	 * Simulate an error scenario after failing to install the GitHub app.
	 */
	private simulateError() {
		// Create a custom error event with data (in this case, 'false' indicating an error)
		const event = new CustomEvent('onError', {
			detail: false
		});

		// Set isLoading to false to indicate that loading has completed
		this.isLoading = false;

		// Dispatch the error event to the parent window
		window.opener.dispatchEvent(event);

		// Log a message indicating that the popup window is closed after failing to install the GitHub app
		console.log('Popup window closed after failed to install GitHub app!');

		// Delay navigation by 2 seconds before closing the window
		this.handleClosedPopupWindow(2000); // 2000 milliseconds (2 seconds)
	}

	/**
	 * Handle the case when the popup window is closed.
	 *
	 * @param ms - Optional delay in milliseconds before closing the window (default: 500 milliseconds)
	 */
	private handleClosedPopupWindow(ms = 500) {
		// Set isLoading to false to indicate that loading has completed
		this.isLoading = false;

		// Delay navigation by 'ms' milliseconds before closing the window
		setTimeout(() => {
			// Close the current window
			window.open("", "_self");
			window.close();
		}, ms); // Delay for 'ms' milliseconds before closing the window
	}
}
