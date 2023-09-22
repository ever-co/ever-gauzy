import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubAppInstallInput, IOrganization } from '@gauzy/contracts';
import { GithubService } from './../../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'github-integration-installations',
	templateUrl: './installations.component.html'
})
export class GithubInstallationsComponent implements OnInit {

	public isLoading: boolean = true;
	public organization: IOrganization;

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _githubService: GithubService,
	) { }

	ngOnInit() {
		this._route.queryParams
			.pipe(
				filter(({ installation_id, setup_action }) => !!installation_id && !!setup_action),
				tap(async ({ installation_id, setup_action, state }: IGithubAppInstallInput) =>
					await this.verifyGitHubAppAuthorization({
						installation_id,
						setup_action,
						state
					})
				),
				untilDestroyed(this)
			)
			.subscribe()
	}

	/**
	 *
	 * @param input
	 */
	async verifyGitHubAppAuthorization(input: IGithubAppInstallInput) {
		const { installation_id, setup_action, state } = input;
		if (installation_id && setup_action && state) {
			const [organizationId, tenantId] = state.split('|');
			try {
				await this._githubService.addInstallationApp({
					installation_id,
					setup_action,
					organizationId,
					tenantId
				});
				this.isLoading = false;

				/** Close current window */
				window.opener = null;
				window.open("", "_self");
				window.close();
			} catch (error) {
				console.log('Error while install github app: %s', installation_id);
			}
		}
	}
}
