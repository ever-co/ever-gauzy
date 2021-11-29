import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NbAuthService, NbLoginComponent, NB_AUTH_OPTIONS } from '@nebular/auth';
import { ElectronService } from 'ngx-electron';
import { environment } from './../../../environments/environment';

@Component({
	selector: 'ngx-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss']
})
export class NgxLoginComponent extends NbLoginComponent implements OnInit {
	
	environment = environment;
	isShown: boolean = false ;

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
		if (this.environment.DEMO) {
			this.user.email = 'admin@ever.co';
			this.user.password = 'admin';
		}
	}

	collapseDemo() {
		this.isShown = !this.isShown;
	}
}
