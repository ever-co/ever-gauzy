import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NB_AUTH_OPTIONS, NbAuthOptions, NbAuthService, NbRegisterComponent } from '@nebular/auth';
import { patterns } from '../../@shared/regex/regex-patterns.const';

@Component({
	selector: 'ngx-register',
	templateUrl: './register.component.html',
	styleUrls: ['./register.component.scss']
})
export class NgxRegisterComponent extends NbRegisterComponent implements OnInit {
	showPassword: boolean = false;
	showConfirmPassword: boolean = false;
	passwordNoSpaceEdges = patterns.passwordNoSpaceEdges;
	emailPopulated = false; // Initialize as false

	constructor(
		protected nbAuthService: NbAuthService,
		protected cdr: ChangeDetectorRef,
		protected router: Router,
		protected route: ActivatedRoute,
		@Inject(NB_AUTH_OPTIONS)
		options: NbAuthOptions
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		this.route.queryParams.subscribe(({ email }) => {
			if (email) {
				// Populate the email field based on query parameters
				this.user.email = email;
				this.emailPopulated = true;
				// Detect changes
				this.cdr.detectChanges();
			}
		});
	}
}
