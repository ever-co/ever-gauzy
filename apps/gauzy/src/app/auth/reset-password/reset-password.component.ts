import { NB_AUTH_OPTIONS, NbAuthService, NbResetPasswordComponent } from "@nebular/auth";
import { ChangeDetectorRef, Component, Inject } from "@angular/core";
import { Router } from "@angular/router";
import { ThemeSwitchService } from "../../@core";

@Component({
	selector: 'ngx-reset-password',
	templateUrl: './reset-password.component.html',
	styleUrls: ['./reset-password.component.scss'],
})
export class NgxResetPasswordComponent extends NbResetPasswordComponent {
	lightMode: number

	constructor (
		public readonly nbAuthService: NbAuthService,
		public readonly cd: ChangeDetectorRef,
		public readonly router: Router,
		private themeSwitchService: ThemeSwitchService,
		@Inject(NB_AUTH_OPTIONS) options,
	) {
		super(nbAuthService, options, cd, router);
	}

	ngOnInit() {
		this.themeSwitchService.lightMode$.subscribe(x => this.lightMode = x)
	}
}