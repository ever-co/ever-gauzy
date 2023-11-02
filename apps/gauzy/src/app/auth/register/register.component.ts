import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { NB_AUTH_OPTIONS, NbAuthOptions, NbAuthService, NbRegisterComponent } from '@nebular/auth';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { patterns } from '../../@shared/regex/regex-patterns.const';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-register',
	templateUrl: './register.component.html',
	styleUrls: ['./register.component.scss']
})
export class NgxRegisterComponent extends NbRegisterComponent implements OnInit {

	public showPassword: boolean = false;
	public showConfirmPassword: boolean = false;
	public passwordNoSpaceEdges = patterns.passwordNoSpaceEdges;
	public queryParams$: Observable<Params>; // Observable for the query params

	constructor(
		protected readonly nbAuthService: NbAuthService,
		protected readonly cdr: ChangeDetectorRef,
		protected readonly router: Router,
		protected readonly activatedRoute: ActivatedRoute,
		@Inject(NB_AUTH_OPTIONS) options: NbAuthOptions
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		// Create an observable to listen to query parameter changes in the current route.
		this.queryParams$ = this.activatedRoute.queryParams.pipe(
			// Filter and ensure that query parameters are present.
			filter((params: Params) => !!params),

			// Tap into the observable to update the 'user.email' property with the 'email' query parameter.
			tap(({ email }: Params) => this.user.email = email),

			// Use 'untilDestroyed' to handle component lifecycle and avoid memory leaks.
			untilDestroyed(this)
		);
	}
}
