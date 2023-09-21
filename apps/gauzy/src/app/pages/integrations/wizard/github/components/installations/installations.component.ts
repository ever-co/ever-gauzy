import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubAppInstallInput, IOrganization } from '@gauzy/contracts';
import { GithubService } from './../../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'github-integration-installations',
	templateUrl: './installations.component.html'
})
export class GithubInstallationsComponent implements OnInit {

	public organization: IOrganization;

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _githubService: GithubService,
	) { }

	ngOnInit() {
		this._route.queryParams
			.pipe(
				tap(({ installation_id, setup_action, state }: IGithubAppInstallInput) => {
					this.verifyGitHubAppAuthorization({
						installation_id,
						setup_action,
						state
					})
				}),
				untilDestroyed(this)
			)
			.subscribe()
	}

	/**
	 *
	 *
	 * @param input
	 */
	async verifyGitHubAppAuthorization(input: IGithubAppInstallInput) {
		const { installation_id, setup_action, state } = input;
		const [organizationId, tenantId] = state.split('|');

		try {
			await this._githubService.addInstallationApp({
				installation_id,
				setup_action,
				organizationId,
				tenantId
			});
		} catch (error) {
			console.log('Error while install github app: %s', installation_id);
		}
	}
}
