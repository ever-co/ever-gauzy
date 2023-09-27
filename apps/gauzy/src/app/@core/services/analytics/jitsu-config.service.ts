import { Inject, Injectable, InjectionToken } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { jitsuAnalytics } from '@jitsu/js';
import { filter } from 'rxjs/operators';
import { Location } from '@angular/common';
export const JITSU_CONFIG = new InjectionToken<any>('jitsuConfig');
@Injectable({
	providedIn: 'root',
})
export class JitsuService {
	private jitsuClient;
	constructor(
		private location: Location,
		private router: Router,
		@Inject(JITSU_CONFIG) private config: any
	) {
		this.jitsuClient = jitsuAnalytics({
			host: config.host,
			writeKey: config.writeKey,
		});
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
