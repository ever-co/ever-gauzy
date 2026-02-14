import { Component } from '@angular/core';

/**
 * Layout shell for the Jobs section (/pages/jobs).
 * Hosts a router-outlet for child routes (Employee, Search, Matching, Proposal Template)
 * registered by job plugins under JOBS_SECTIONS_LOCATION.
 */
@Component({
	selector: 'ga-job-layout',
	template: ` <router-outlet></router-outlet> `,
	styles: [
		`
			:host {
				display: block;
				height: 100%;
			}
		`
	],
	standalone: false
})
export class JobLayoutComponent {}
