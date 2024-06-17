import { Component } from '@angular/core';
import { Store } from '@gauzy/ui-core/common';
import { ActivatedRoute, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

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
		this._route.queryParams.pipe(filter((params) => params.jwt)).subscribe(async ({ jwt, userId }) => {
			this._store.token = jwt;
			this._store.userId = userId;
			await this._router.navigate(['/']);
		});
	}
}
