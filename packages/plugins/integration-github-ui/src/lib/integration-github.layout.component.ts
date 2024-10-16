import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: `ngx-integration-github-layout`,
	template: `<router-outlet></router-outlet>`
})
export class IntegrationGithubLayoutComponent implements OnInit {
	constructor(private readonly _router: Router, private readonly _activatedRoute: ActivatedRoute) {}

	ngOnInit() {
		this._activatedRoute.data
			.pipe(
				tap(({ integration }: Data) => {
					const path = integration
						? `/pages/integrations/github/${integration.id}`
						: '/pages/integrations/github/setup/wizard';

					this._router.navigate([path]);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
