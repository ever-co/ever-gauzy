import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '@env/environment';
import { IOrganization } from '@gauzy/contracts';
import { distinctUntilChange, toParams } from '@gauzy/common-angular';
import { Store } from '../../../../../../@core/services';
import { GITHUB_AUTHORIZATION_URL } from '../../github.config';

@UntilDestroy()
@Component({
	templateUrl: './authorization.component.html'
})
export class GithubAuthorizationComponent implements OnInit {

	public organization: IOrganization;
	public isLoading: boolean = true;
	// save a reference to the window so we can close it
	private window = null;

	constructor(
		private readonly router: Router,
		private readonly store: Store,
	) { }

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.githubAppInstallation()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Authorize a client for GitHub integration.
	 * Redirect the user to GitHub for authorization.
	 */
	private async oAuthAppAuthorization() {
		const redirect_uri = environment.GITHUB_REDIRECT_URL;
		const client_id = environment.GITHUB_CLIENT_ID;

		// Define your query parameters
		const queryParams = toParams({
			'redirect_uri': `${redirect_uri}`,
			'client_id': `${client_id}`,
			'scope': 'user'
		});

		// Construct the external URL with the query parameters
		const externalUrl = `${GITHUB_AUTHORIZATION_URL}?${queryParams.toString()}`;

		/** Navigate to the external URL with query parameters */
		window.location.replace(externalUrl);
	}

	/**
	 * Handle GitHub App installation flow.
	 */
	private async githubAppInstallation() {
		if (!this.organization) {
			return;
		}
		try {
			if (!this.window || this.window.closed) {
				// If no window is open or the existing window is closed, open a new one
				this.openPopupWindow();
			} else {
				// If a window is already open, you can handle it here (e.g., focus or bring it to the front)
				this.window.focus();
			}
			this.checkPopupWindowStatus();
		} catch (error) {
			console.log('Error while setup GitHub integration: %s', error?.message);
		}
	}

	/**
	 * Open a popup window for GitHub App installation.
	 */
	private async openPopupWindow() {
		const { id: organizationId, tenantId } = this.organization;
		const state = `${organizationId}|${tenantId}`;

		const width = 800, height = 800;
		const left = window.innerWidth - width; // Adjust the left position to place it on the right side
		const top = window.innerHeight / 2 - height / 2;

		// Specify a unique window name to identify the window
		const windowName = 'githubAppInstallationWindow';

		// Check if a window with the same name is already open
		if (window.frames[windowName] && !window.frames[windowName].closed) {
			// A window with the same name is already open, so focus on it
			window.frames[windowName].focus();
		} else {
			/** Navigate to the external URL with query parameters */
			this.window = window.open(`https://github.com/apps/${environment.GITHUB_APP_NAME}/installations/new?state=${state.toString()}`, windowName, `width=${width}, height=${height}, top=${top}, left=${left}`);
		}
	}

	/**
	 * Check the status of the popup window.
	 */
	private async checkPopupWindowStatus() {
		const timer = setInterval(() => {
			console.log(this.window);
			if (this.window == null || this.window.closed) {
				clearInterval(timer); // Stop checking when the window is closed
				/** */
				this.handleClosedPopupWindow();
			} else {
				console.log('Popup window still open');
			}
		}, 1000); // Check every second (adjust the interval as needed)
	}

	/**
	 * Handle the case when the popup window is closed.
	 */
	private handleClosedPopupWindow() {
		this.isLoading = false;
		console.log('Popup window closed');

		// Delay navigation by 5 seconds before redirecting
		setTimeout(() => {
			this.router.navigate(['/pages/integrations/new']);
		}, 5000); // 5000 milliseconds = 5 seconds
	}
}
