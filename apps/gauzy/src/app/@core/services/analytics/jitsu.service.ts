import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { jitsuAnalytics, emptyAnalytics, AnalyticsInterface } from '@jitsu/js';
import { filter } from 'rxjs/operators';
import { Location } from '@angular/common';
import { Store } from '@datorama/akita';
import { environment } from '@env/environment';

@Injectable({
	providedIn: 'root',
})
export class JitsuService {
	private jitsuClient: AnalyticsInterface;
	constructor(
		private location: Location,
		private router: Router,
		private store: Store
	) {
		this.jitsuClient =
			environment.JITSU_BROWSER_HOST &&
			environment.JITSU_BROWSER_WRITE_KEY
				? jitsuAnalytics({
						host: environment.JITSU_BROWSER_HOST,
						writeKey: environment.JITSU_BROWSER_WRITE_KEY,
				  })
				: emptyAnalytics;
	}
	async identify(
		id?: string | object,
		traits?: Record<string, any> | Function | null
	): Promise<any> {
		return await this.jitsuClient.identify(id, traits);
	}

	trackPageViews() {
		this.router.events
			.pipe(filter((event) => event instanceof NavigationEnd))
			.subscribe(() => {
				this.page('pageview', this.location.path());
			});
	}

	async trackEvents(
		event: string,
		properties?: Record<string, any> | null
	): Promise<any> {
		return await this.jitsuClient.track(event, properties);
	}

	async page(name: string, url: string): Promise<any> {
		return await this.jitsuClient.page({
			name: name,
			environment: window.navigator.platform,
			context: {
				page: {
					url: url,
				},
			},
		});
	}
}
