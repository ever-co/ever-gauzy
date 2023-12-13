import { NbAuthComponent, NbAuthService } from "@nebular/auth";
import { Component, OnInit } from "@angular/core";
import { Location } from '@angular/common';
import { ActivatedRoute, NavigationStart, Params, Router } from "@angular/router";
import { filter } from "rxjs/operators";
import { Observable, map, tap } from "rxjs";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-auth',
	templateUrl: './auth.component.html',
	styleUrls: ['./auth.component.scss'],
})
export class NgxAuthComponent extends NbAuthComponent implements OnInit {
	isRegister: boolean = false;
	public queryParams$: Observable<Params>; // Observable for the query params

	constructor(
		protected readonly auth: NbAuthService,
		protected readonly location: Location,
		private readonly _router: Router,
		private readonly _route: ActivatedRoute
	) {
		super(auth, location);
	}

	updateRegisterClass(url: string) {
		this.isRegister = url === '/auth/register';
	}

	ngOnInit() {
		this.updateRegisterClass(this._router.url);

		// Create an observable to listen to query parameter changes in the current route.
		this.queryParams$ = this._route.queryParams.pipe(
			// Filter and ensure that query parameters are present.
			filter((params: Params) => !!params),

			// Use 'untilDestroyed' to handle component lifecycle and avoid memory leaks.
			untilDestroyed(this)
		);

		this._router.events.pipe(
			filter((event) => event instanceof NavigationStart),
			map((event) => event as NavigationStart),
		).subscribe((event) => {
			this.updateRegisterClass(event.url);
		});
	}

	/**
 * Go back to the return URL.
 */
	goBack() {
		// Access query parameters from the snapshot.
		const returnUrl = this._route.snapshot.queryParamMap.get('returnUrl');

		if (returnUrl) {
			if (this.isExternalUrl(returnUrl)) {
				// If it's an external URL, navigate to it using window.location.href.
				window.location.href = returnUrl;
			} else {
				// If it's an Angular app URL, navigate within the Angular application.
				this._router.navigate([returnUrl], { replaceUrl: true });
			}
		} else {
			// Handle the case when returnUrl is not provided.
			// You can navigate to a default route or display an error message.
			console.error('No return URL provided.');
		}
	}

	/**
	 * Check if a URL is external (not part of the Angular app).
	 */
	isExternalUrl(url: string): boolean {
		const location = window.location;
		const currentOrigin = location.origin;
		return !url.startsWith(currentOrigin);
	}
}
