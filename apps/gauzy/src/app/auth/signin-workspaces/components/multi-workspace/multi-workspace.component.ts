import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-multi-workspace-onboarding',
	templateUrl: './multi-workspace.component.html',
	styleUrls: ['./multi-workspace.component.scss']
})
export class MultiWorkspaceOnboardingComponent implements OnInit {

	workspaces: [];

	constructor(
		private readonly router: Router,
	) { }

	ngOnInit() { }
}
