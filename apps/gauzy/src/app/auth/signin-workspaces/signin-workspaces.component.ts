import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-multitenant-login',
	template: `
		<nb-layout windowMode>
			<nb-layout-column>
				<router-outlet></router-outlet>
			</nb-layout-column>
		</nb-layout>
	`
})
export class SigninWorksapcesLayoutComponent implements OnInit, OnDestroy {

	constructor() { }

	ngOnInit() { }

	ngOnDestroy() { }
}
