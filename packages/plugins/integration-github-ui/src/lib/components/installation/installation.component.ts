import { AfterViewInit, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubAppInstallInput, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { GithubService, Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-integration-github-installation',
    templateUrl: './installation.component.html',
    standalone: false
})
export class GithubInstallationComponent implements AfterViewInit, OnInit {
	public isLoading: boolean = true;
	public organization: IOrganization;
	/** Why the installation was refused, as the API explained it — shown instead of closing silently. */
	public errorMessage: string | null = null;
	public hasError: boolean = false;
	/** GitHub redirects here after an installation is edited on GitHub; there is nothing to connect. */
	public updatedOnGithub: boolean = false;
	/** A member asked an owner to install the App; nothing is connected until the owner approves. */
	public requestedOnGithub: boolean = false;

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _githubService: GithubService,
		private readonly _store: Store
	) {}

	/**
	 * Initialize the component when it is created.
	 * This method sets up an observable subscription to listen for query parameters in the URL.
	 */
	ngOnInit(): void {
		this._route.queryParams
			.pipe(
				// Editing an installation on GitHub lands here with no state: there is nothing to connect.
				tap(({ setup_action, state }) => {
					if (setup_action === 'request') {
						this.requestedOnGithub = true;
						this.isLoading = false;
					}
					if (setup_action === 'update' && !state) {
						this.updatedOnGithub = true;
						this.isLoading = false;
					}
				}),
				// Filter and keep only valid queryParams with 'installation_id', 'setup_action' and the
				// single-use 'state' nonce (required to bind the installation to the initiating tenant).
				filter(
					({ installation_id, setup_action, state }) => !!installation_id && !!setup_action && !!state
				),
				tap(() => (this.organization = this._store.selectedOrganization)),
				// Use 'tap' operator to perform an asynchronous action
				tap(
					// `install_proof` is the API's signed statement that the GitHub user who completed the
					// installation is entitled to it (GHSA-4rwq-65wh-45h4); `install_check` says why when absent.
					async ({ installation_id, setup_action, state, install_proof, install_check }: IGithubAppInstallInput) =>
						await this.verifyGitHubAppAuthorization({
							installation_id,
							setup_action,
							state,
							...(install_proof ? { install_proof } : {}),
							...(install_check ? { install_check } : {})
						})
				),
				// Use 'untilDestroyed' operator to automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			// Subscribe to the observable to start listening for query parameters
			.subscribe();
	}

	/**
	 *
	 */
	ngAfterViewInit(): void {}

	/**
	 * Verify GitHub application authorization and perform actions based on input parameters.
	 *
	 * @param input - An object containing input parameters, including 'installation_id', 'setup_action', and 'state'.
	 */
	private async verifyGitHubAppAuthorization(input: IGithubAppInstallInput) {
		// Do NOT gate on a hydrated organization: the server binds the installation to the tenant/org
		// recorded against the nonce, so a not-yet-hydrated store must not drop a valid GitHub callback.
		const { installation_id, setup_action, state, install_proof, install_check } = input;

		// The installation is bound server-side to the tenant/organization recorded against the
		// single-use `state` nonce minted at initiation, so we forward only GitHub's identifiers plus
		// the nonce — never a client-supplied tenant/organization (cross-tenant IDOR, GHSA-4rwq-65wh-45h4).
		// `install_proof` proves the installing GitHub user is entitled to it; the API verifies it.
		if (installation_id && setup_action && state) {
			try {
				// Call a service method (likely from _githubService) to add the installation app
				const integration = await this._githubService.addInstallationApp({
					installation_id,
					setup_action,
					state,
					...(install_proof ? { install_proof } : {}),
					...(install_check ? { install_check } : {})
				});

				// Simulate a success scenario, possibly updating the UI or performing other actions
				this.simulateSuccess(integration);
			} catch (error) {
				// Handle errors, such as failed GitHub app installation
				console.log('Error while failed to install GitHub app: %s', installation_id);

				// Show the API's reason in the popup (it usually needs an administrator to act on it)
				this.simulateError(error?.error?.message ?? error?.message);
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

		// Dispatch the success event to the parent window. Guarded: this runs inside the try block of
		// verifyGitHubAppAuthorization, so a missing opener would otherwise report a CONNECTED
		// installation as "GitHub was not connected".
		window.opener?.dispatchEvent(event);

		// Log a message indicating that the popup window is closed after GitHub app installation
		console.log('Popup window closed after GitHub app installed!');

		// Delay navigation by 2 seconds before closing the window
		this.handleClosedPopupWindow(2000); // 2000 milliseconds (2 seconds)
	}

	/**
	 * Simulate an error scenario after failing to install the GitHub app.
	 */
	private simulateError(message?: string) {
		// Create a custom error event with data (in this case, 'false' indicating an error)
		const event = new CustomEvent('onError', {
			detail: false
		});

		// Set isLoading to false to indicate that loading has completed
		this.isLoading = false;
		this.hasError = true;
		// The API's reason when it gave one; the template falls back to a translated generic message.
		this.errorMessage = typeof message === 'string' && message ? message : null;

		// Dispatch the error event to the parent window
		window.opener?.dispatchEvent(event);

		// Stay open: the reason usually needs an administrator to act on it (for example the GitHub App
		// setting that lets Gauzy verify who installed it), so closing after two seconds would hide it.
		console.log('Failed to install GitHub app: %s', this.errorMessage);
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
			window.open('', '_self');
			window.close();
		}, ms); // Delay for 'ms' milliseconds before closing the window
	}
}
