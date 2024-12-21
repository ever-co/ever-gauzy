import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '@gauzy/ui-config';
import { IOrganization } from '@gauzy/contracts';
import { distinctUntilChange, toParams } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { GITHUB_AUTHORIZATION_URL } from '../../github.config';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-integration-github-wizard',
    templateUrl: './wizard.component.html',
    standalone: false
})
export class GithubWizardComponent implements AfterViewInit, OnInit, OnDestroy {
	/**
	 * Event listener function for handling the 'window:onSuccess' custom event.
	 * This function is triggered when a custom event named 'window:onSuccess' occurs,
	 * typically in response to a specific user action or external event.
	 *
	 * @param event - The event object containing information about the custom event.
	 */
	@HostListener('window:onSuccess', ['$event'])
	onSuccessEvent(event: CustomEvent) {
		// Handle the custom event data here

		// Set the isLoading property to false, indicating that the loading is complete
		this.loading = false;

		// Delay the navigation to a specific URL by 100 milliseconds before redirecting
		// This is often used to provide a smoother user experience
		this.timer = setTimeout(() => {
			// Redirect the user to a specific URL, typically related to a successful operation
			this._router.navigate(['/pages/integrations/github/', event.detail.id]);
		}, 100); // 100 milliseconds
	}

	public organization: IOrganization;
	public loading: boolean = true;
	// save a reference to the window so we can close it
	private window = null;
	private timer: any;

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		private readonly _store: Store
	) {}

	/**
	 * This method is part of the Angular lifecycle and is called when the component is initialized.
	 * It sets up an observable subscription to listen for data from the ActivatedRoute.
	 * When data is received, it checks if there is an 'integration' object in the data.
	 * If 'integration' data is present, it redirects the user to a specific URL related to that integration.
	 */
	ngOnInit(): void {
		this._activatedRoute.data
			.pipe(
				filter(({ integration }: Data) => !!integration),
				// Use the 'tap' operator to perform side effects when data is emitted
				tap(({ integration }: Data) => {
					// Check if 'integration' data is present in the emitted data
					if (integration) {
						// Redirect the user to a specific URL related to the integration
						this._router.navigate(['/pages/integrations/github', integration.id]);
					}
				}),
				// Use the 'untilDestroyed' operator to automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			// Subscribe to the observable to start listening for data
			.subscribe();
	}

	/**
	 * This method is part of the Angular lifecycle and is called after the component's view has been initialized.
	 * It sets up an observable subscription to listen for changes in the selected organization.
	 * When the selected organization changes, it performs the following actions:
	 * 1. Debounces the changes to avoid excessive updates (waits for 200 milliseconds of inactivity).
	 * 2. Ensures that the organization is valid (truthy) before proceeding.
	 * 3. Sets the 'organization' property to the selected organization.
	 * 4. Calls the 'startGitHubAppInstallation' method.
	 * 5. Uses the 'untilDestroyed' operator to automatically unsubscribe when the component is destroyed.
	 */
	ngAfterViewInit(): void {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				// Debounce changes to avoid excessive updates (waits for 200 milliseconds of inactivity)
				debounceTime(200),
				// Ensure that the organization is valid (truthy) before proceeding
				filter((organization: IOrganization) => !!organization),
				// Set the 'organization' property to the selected organization
				tap((organization: IOrganization) => (this.organization = organization)),
				// Call the 'startGitHubAppInstallation' method
				tap(() => this.startGitHubAppInstallation()),
				// Use the 'untilDestroyed' operator to automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			// Subscribe to the observable to start listening for changes in the selected organization
			.subscribe();
	}

	/**
	 * Initiate OAuth authorization for a GitHub application.
	 * Redirect the user to GitHub's authorization endpoint.
	 */
	private async oAuthAppAuthorization() {
		// Get the redirect URI, Post Install URL and client ID from the environment
		const redirect_uri = environment.GAUZY_GITHUB_REDIRECT_URL;
		const client_id = environment.GAUZY_GITHUB_CLIENT_ID;
		const post_install_url = environment.GAUZY_GITHUB_POST_INSTALL_URL;

		// Define the query parameters for the authorization request
		const queryParams = toParams({
			redirect_uri: `${redirect_uri}`,
			client_id: `${client_id}`,
			scope: 'user',
			state: `${post_install_url}`
		});

		// Construct the external URL for GitHub authorization with the query parameters
		const externalUrl = `${GITHUB_AUTHORIZATION_URL}?${queryParams.toString()}`;
		console.log('External Github OAuth App URL: %s', externalUrl);

		// Redirect the user's browser to the GitHub authorization URL
		// This action starts the GitHub OAuth authorization process
		window.location.replace(externalUrl);
	}

	/**
	 * Start the installation process of a GitHub application.
	 * This method manages the behavior of a popup window used for the installation.
	 */
	private async startGitHubAppInstallation() {
		if (!this.organization) {
			// If there is no selected organization, return early
			return;
		}

		try {
			if (!this.window || this.window.closed) {
				// If no window is open or the existing window is closed, open a new one
				this.openGitHubAppPopup();
			} else {
				// If a window is already open, you can handle it here (e.g., focus or bring it to the front)
				this.focusGitHubAppPopup();
			}
			// Check the status of the popup window
			this.checkPopupWindowStatus();
		} catch (error) {
			// Handle any errors that may occur during the setup of GitHub integration
			console.log('Error while setting up GitHub integration: %s', error?.message);
		}
	}

	/**
	 * Focus on an existing GitHub application popup window.
	 * This method is used when a popup window is already open and needs to be brought to the foreground.
	 */
	private focusGitHubAppPopup() {
		// Focus on the existing popup window
		this.window.focus();
	}

	/**
	 * Open a new popup window for GitHub application installation.
	 */
	private async openGitHubAppPopup() {
		if (!this.organization) {
			return;
		}

		// Specify the width and height for the popup window
		const width = 600,
			height = 600;

		// Calculate the left and top positions for the popup window
		const left = window.innerWidth - width; // Adjust the left position to place it on the right side
		const top = window.innerHeight / 2 - height / 2;

		// Specify a unique window name to identify the window
		const windowName = environment.GAUZY_GITHUB_APP_NAME;

		// Check if a window with the same name is already open
		if (window.frames[windowName] && !window.frames[windowName].closed) {
			// A window with the same name is already open, so focus on it
			window.frames[windowName].focus();
		} else {
			// Destructure environment variables for better readability
			const { GAUZY_GITHUB_APP_NAME, GAUZY_GITHUB_REDIRECT_URL, GAUZY_GITHUB_POST_INSTALL_URL } = environment;
			// Get the redirect URI, Post Install URL from the environment
			const redirect_uri = GAUZY_GITHUB_REDIRECT_URL;
			// const client_id = environment.GAUZY_GITHUB_CLIENT_ID;
			const postInstallURL = GAUZY_GITHUB_POST_INSTALL_URL;

			// Define the query parameters for the authorization request
			const queryParams = toParams({
				redirect_uri: `${redirect_uri}`,
				state: `${postInstallURL}`
			});

			// Construct the external URL for GitHub authorization with the query parameters
			/** Navigate to the target external URL */
			const url = `https://github.com/apps/${GAUZY_GITHUB_APP_NAME}/installations/new?${queryParams.toString()}`;
			console.log('External Github App Installation URL: %s', url);

			/** Navigate to the external URL with query parameters */
			this.window = window.open(
				url,
				windowName,
				`width=${width},height=${height},top=${top},left=${left},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
			);
		}
	}

	/**
	 * Continuously check the status of a popup window.
	 * When the window is closed, take appropriate actions.
	 */
	private async checkPopupWindowStatus() {
		const timer = setInterval(() => {
			if (!this.timer) {
				if (this.window == null || this.window.closed) {
					clearInterval(timer); // Stop checking when the window is closed
					// Call a method to handle the closed popup window
					this.handleClosedPopupWindow();
				}
			}
		}, 500); // Check every 500 milliseconds (adjust the interval as needed)
	}

	/**
	 *  Handle the case when the popup window is closed.
	 *
	 * @param ms The delay in milliseconds before redirecting. Default is 200 milliseconds.
	 */
	private handleClosedPopupWindow(ms: number = 200): void {
		// Set isLoading to false to indicate that loading has completed
		this.loading = false;

		// Delay navigation by 'ms' milliseconds before redirecting
		setTimeout(() => {
			const data = this._activatedRoute.snapshot.data;
			if (data['redirectTo']) {
				this._router.navigate([data['redirectTo']]);
				return;
			}
			// Navigate to a specific route, e.g., '/pages/integrations'
			this._router.navigate(['/pages/integrations']);
		}, ms); // Delay for 'ms' milliseconds before redirecting
	}

	/**
	 * Angular lifecycle hook called when the component is destroyed.
	 * Clear the timeout when the component is destroyed to prevent memory leaks.
	 */
	ngOnDestroy(): void {
		// Clear the timeout (if it exists) when the component is destroyed
		if (this.timer) {
			clearTimeout(this.timer);
		}
	}
}
