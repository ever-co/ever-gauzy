import { Component, OnInit } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-sign-in-workspaces-layout',
	template: `
		<nb-layout windowMode>
			<nb-layout-column>
				<router-outlet></router-outlet>
			</nb-layout-column>
		</nb-layout>
	`
})
export class SignInWorkspacesLayoutComponent implements OnInit {

	constructor() { }

	ngOnInit() { }
}
