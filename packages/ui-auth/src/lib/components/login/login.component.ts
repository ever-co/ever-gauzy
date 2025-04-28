import { ChangeDetectorRef, Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormGroupDirective } from '@angular/forms';
import { NbAuthService, NbLoginComponent, NB_AUTH_OPTIONS } from '@nebular/auth';
import { CookieService } from 'ngx-cookie-service';
import { RolesEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { ElectronService } from '@gauzy/ui-core/core';
import { patterns } from '@gauzy/ui-core/shared';

@Component({
    selector: 'ngx-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
    standalone: false
})
export class NgxLoginComponent extends NbLoginComponent implements OnInit {
	@ViewChild('form') private readonly form: FormGroupDirective;

	isShown = false;
	RolesEnum = RolesEnum;
	isDemo: boolean = environment.DEMO;
	showPassword = false;
	passwordNoSpaceEdges = patterns.passwordNoSpaceEdges;

	constructor(
		private readonly cookieService: CookieService,
		public readonly nbAuthService: NbAuthService,
		public readonly cdr: ChangeDetectorRef,
		public readonly router: Router,
		public readonly electronService: ElectronService,
		private readonly el: ElementRef,
		@Inject(NB_AUTH_OPTIONS) options
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		// -- to not block the scroll after logout
		const body = this.el.nativeElement.closest('body');
		body.removeAttribute('style');
		this.checkRememberdMe();
		this.autoFillCredential();
	}

	/**
	 * Implemented Rememberd Me Feature
	 */
	checkRememberdMe() {
		if (this.cookieService.check('rememberMe')) {
			const { email, rememberMe } = this.cookieService.getAll();
			this.user.email = email;
			this.user.rememberMe = rememberMe;
		}
	}

	collapseDemo() {
		if (this.isDemo) {
			this.isShown = !this.isShown;
		}
	}

	/**
	 * Autofill Super Admin Credential By Default
	 */
	autoFillCredential() {
		if (this.isDemo) {
			this.user.email = environment.DEMO_SUPER_ADMIN_EMAIL;
			this.user.password = environment.DEMO_SUPER_ADMIN_PASSWORD;
		}
	}

	/**
	 * Automatic Login For Demo Server
	 *
	 * @param role
	 */
	autoLogin(role: RolesEnum) {
		if (this.isDemo) {
			switch (role) {
				case RolesEnum.SUPER_ADMIN:
					this.autoFillCredential();
					break;
				case RolesEnum.ADMIN:
					this.user.email = environment.DEMO_ADMIN_EMAIL;
					this.user.password = environment.DEMO_ADMIN_PASSWORD;
					break;
				case RolesEnum.EMPLOYEE:
					this.user.email = environment.DEMO_EMPLOYEE_EMAIL;
					this.user.password = environment.DEMO_EMPLOYEE_PASSWORD;
					break;
				default:
					break;
			}
			this.form.ngSubmit.emit();
		}
	}
}
