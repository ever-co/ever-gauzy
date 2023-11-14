import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { NbAuthService, NbLoginComponent, NB_AUTH_OPTIONS } from '@nebular/auth';
import { RolesEnum } from 'packages/contracts/dist';
import { ElectronService } from '../../@core/auth/electron.service';

@Component({
	selector: 'ngx-login-magic',
	templateUrl: './login-magic.component.html',
	styleUrls: ['./login-magic.component.scss']
})
export class NgxLoginMagicComponent extends NbLoginComponent implements OnInit {
	isSendingEmail: boolean = false;
	isDemo: boolean = environment.DEMO;
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

	ngOnInit(): void {}

	async login() {
		try {
			this.isSendingEmail = true;
			// -- 5 seconds delay for testing purposes (remove when API implemented)
			await new Promise<void>((res, rej) => {
				setTimeout(() => res(), 1000 * 3);
			});
			/**
			 * Code goes here
			 */
		} catch (err) {
			/**
			 * Handle error
			 */
		}
		this.isSendingEmail = false;
	}

	autoLogin(role: RolesEnum) {}
}
