import { ChangeDetectorRef, Component, Inject, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NbAuthService, NbLoginComponent, NB_AUTH_OPTIONS } from '@nebular/auth';
import { ElectronService } from 'ngx-electron';
import { RolesEnum } from '@gauzy/contracts/';
import { environment } from './../../../environments/environment';
import { FormGroupDirective } from '@angular/forms';

@Component({
	selector: 'ngx-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss']
})
export class NgxLoginComponent extends NbLoginComponent implements OnInit {

	@ViewChild('form') private readonly form: FormGroupDirective;
	
	environment = environment;
	isShown: boolean = false;
	RolesEnum = RolesEnum;

	constructor(
		public readonly electronService: ElectronService,
		public readonly nbAuthService: NbAuthService,
		public readonly cdr: ChangeDetectorRef, 
		public readonly router: Router,
		@Inject(NB_AUTH_OPTIONS) options
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {
		this.autoFillCredential();
	}

	collapseDemo() {
		if (this.environment.DEMO) {
			this.isShown = !this.isShown;
		}
	}

	/**
	 * Autofill Super Admin Credential By Default
	 */
	autoFillCredential() {
		if (this.environment.DEMO) {
			this.user.email = this.environment.DEMO_SUPER_ADMIN_EMAIL;
			this.user.password = this.environment.DEMO_SUPER_ADMIN_PASSWORD;
		}
	}

	/**
	 * Automatic Login For Demo Server
	 * 
	 * @param role 
	 */
	autoLogin(role: RolesEnum) {
		if (this.environment.DEMO) {
			switch (role) {
				case RolesEnum.SUPER_ADMIN:
					this.autoFillCredential();
					break;
				case RolesEnum.ADMIN:
					this.user.email = this.environment.DEMO_ADMIN_EMAIL;
					this.user.password = this.environment.DEMO_ADMIN_PASSWORD;
					break;
				case RolesEnum.EMPLOYEE:
					this.user.email = this.environment.DEMO_EMPLOYEE_EMAIL;
					this.user.password = this.environment.DEMO_EMPLOYEE_PASSWORD;
					break;
				default:
					break;
			}
			this.form.ngSubmit.emit();
		}
	}
}
