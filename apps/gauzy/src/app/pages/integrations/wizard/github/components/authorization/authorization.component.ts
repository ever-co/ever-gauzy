import { Component, OnInit } from '@angular/core';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '@env/environment';
import { IOrganization, IntegrationEnum } from '@gauzy/contracts';
import { distinctUntilChange, toParams } from '@gauzy/common-angular';
import { Store } from '../../../../../../@core/services';
import { GITHUB_AUTHORIZATION_URL } from '../../github.config';
import { Router } from '@angular/router';

@UntilDestroy()
@Component({
	template: ''
})
export class GithubAuthorizationComponent implements OnInit {

	public organization: IOrganization;

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
	 * Authorize a client for Github integration.
	 * Redirect the user to GitHub for authorization
	 */
	private oAuthAppAuthorization() {
		const redirect_uri = environment.GITHUB_POST_INSTALLATION_URL;
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
	 *
	 */
	private githubAppInstallation() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		const state = organizationId + '|' + tenantId;

		const width = 600, height = 600;
		const left = window.innerWidth / 2 - width / 2;
		const top = window.innerHeight / 2 - height / 2;

		/** Navigate to the external URL with query parameters */
		window.open(`https://github.com/apps/${environment.GITHUB_APP_NAME}/installations/new?state=${state.toString()}`, "", `width=${width}, height=${height}, top=${top}, left=${left}`);

		/**
		 *
		 */
		this.router.navigate(['/pages/integrations/new'], {
			queryParams: {
				provider: IntegrationEnum.GITHUB
			}
		});
	}
}
