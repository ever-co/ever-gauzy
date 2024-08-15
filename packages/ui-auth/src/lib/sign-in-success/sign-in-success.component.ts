import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { Store } from '@gauzy/ui-core/core';

@Component({
	selector: 'ga-sign-in-success',
	templateUrl: './sign-in-success.component.html'
})
export class SignInSuccessComponent {
	constructor(
		private readonly _store: Store,
		private readonly _route: ActivatedRoute,
		private readonly _router: Router
	) {
		this._route.queryParams
			.pipe(
				tap((params) => {
					// If no 'jwt' param is found, navigate to root
					if (!params.jwt) {
						this._router.navigate(['/']);
					}
				}),
				filter((params) => !!params.jwt) // Continue only if 'jwt' exists
			)
			.subscribe(async ({ jwt, userId }) => {
				this._store.token = jwt;
				this._store.userId = userId;
				await this._router.navigate(['/']);
			});
	}
}
