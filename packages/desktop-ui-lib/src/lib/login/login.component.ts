import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NbAuthService, NbLoginComponent, NB_AUTH_OPTIONS } from '@nebular/auth';
import { ElectronService } from 'ngx-electron';

@Component({
	selector: 'ngx-desktop-timer-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss']
})
export class NgxLoginComponent extends NbLoginComponent 
	implements OnInit {

  	showPassword: boolean = false;

	constructor(
		public readonly electronService: ElectronService,
		public readonly nbAuthService: NbAuthService,
		public readonly cdr: ChangeDetectorRef,
		public readonly router: Router,
		@Inject(NB_AUTH_OPTIONS) options
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit() {}
}
