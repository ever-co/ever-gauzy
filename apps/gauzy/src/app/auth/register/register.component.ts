import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { NbAuthService, NbRegisterComponent } from '@nebular/auth';
import { patterns } from '../../@shared/regex/regex-patterns.const';

@Component({
	selector: 'ngx-register',
	templateUrl: './register.component.html',
	styleUrls: ['./register.component.scss'],
})
export class NgxRegisterComponent extends NbRegisterComponent implements OnInit {
	showPassword: boolean = false;
	showConfirmPassword: boolean = false;
	passwordNoSpaceEdges = patterns.passwordNoSpaceEdges;
	emailPopulated = false; // Initialize as false

	constructor(
		protected authService: NbAuthService,
		protected cd: ChangeDetectorRef,
		protected router: Router,
		public route: ActivatedRoute
	) {
		super(authService, {}, cd, router);
	}

	ngOnInit() {
		this.route.queryParams.subscribe((params: Params) => {
			if (params['email']) {
				// Populate the email field based on query parameters
				this.user.email = params['email'];
				this.emailPopulated = true; // Set to true if email is populated
			}
		});
	}

}
