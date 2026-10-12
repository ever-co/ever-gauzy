import { Component } from '@angular/core';

/**
 * Layout shell for the Jobs section (/pages/jobs).
 * Hosts a router-outlet for child routes (Employee, Search, Matching, Proposal Template)
 * registered by job plugins under JOBS_SECTIONS_LOCATION.
 */
@Component({
	selector: 'ga-job-layout',
	// The Jobs section's content region is the page's main landmark (the app shell defines none). Its spec
	// has asserted `main[role="main"]` since the layout was added; the template never rendered one.
	template: ` <main role="main"><router-outlet></router-outlet></main> `,
	styles: [
		`
			:host,
			main {
				display: block;
				height: 100%;
			}
		`
	],
	standalone: false
})
export class JobLayoutComponent {}
