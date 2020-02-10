import { Component } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { ActivatedRoute, Router } from '@angular/router';
import 'rxjs/add/operator/filter';

@Component({
	selector: 'ga-sign-in-success',
	templateUrl: './sign-in-success.component.html',
	styleUrls: ['./sign-in-success.component.scss']
})
export class SignInSuccessComponent {
	constructor(
		private readonly _store: Store,
		private readonly _route: ActivatedRoute,
		private readonly _router: Router
	) {
		this._route.queryParams
			.filter((params) => params.jwt)
			.subscribe(async ({ jwt, userId }) => {
				this._store.token = jwt;
				this._store.userId = userId;
				await this._router.navigate(['/']);
			});
	}
}
