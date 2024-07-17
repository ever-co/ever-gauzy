import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	template: ` <router-outlet></router-outlet> `
})
export class GithubComponent implements OnInit {
	constructor(private readonly _router: Router, private readonly _activatedRoute: ActivatedRoute) {}

	/**
	 *
	 */
	ngOnInit() {
		this._activatedRoute.data
			.pipe(
				tap(({ integration }: Data) => {
					if (integration) {
						this._router.navigate(['/pages/integrations/github', integration.id]);
					} else {
						this._router.navigate(['/pages/integrations/github/setup/wizard']);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
