import { AfterViewInit, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubAppInstallInput, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { GithubService, Store } from './../../../../../../@core/services';

interface IGithuIntegrationAuthorizationResponse {
	state?: string;
	provider?: string;
	code?: string;
}

@UntilDestroy()
@Component({
	selector: 'github-integration-installations',
	templateUrl: './installations.component.html'
})
export class GithubInstallationsComponent implements AfterViewInit, OnInit {

	public organization: IOrganization;

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _store: Store,
		private readonly _githubService: GithubService,
	) { }

	ngAfterViewInit() { }

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.verifyGitHubAppAuthorization()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 * @returns
	 */
	verifyGitHubAppAuthorization() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		// const client_id = environment.GITHUB_CLIENT_ID;

		const { installation_id, setup_action } = this._route.snapshot.queryParams as IGithubAppInstallInput;
		console.log(installation_id, setup_action, organizationId, tenantId);
		console.log(this._githubService);
	}
}
