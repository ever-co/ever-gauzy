import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NbAuthService, NbLoginComponent, NB_AUTH_OPTIONS } from '@nebular/auth';

@Component({
	selector: 'ngx-social-links',
	templateUrl: './social-links.component.html',
	styleUrls: ['./social-links.component.scss']
})
export class SocialLinksComponent extends NbLoginComponent implements OnInit {
	constructor(
		public readonly nbAuthService: NbAuthService,
		public readonly cdr: ChangeDetectorRef,
		public readonly router: Router,
		@Inject(NB_AUTH_OPTIONS) options
	) {
		super(nbAuthService, options, cdr, router);
	}

	ngOnInit(): void {}
}
