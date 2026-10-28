import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Location } from '@angular/common';
import { filter } from 'rxjs/operators';
import { jitsuAnalytics, emptyAnalytics, AnalyticsInterface } from '@jitsu/js';
import { environment } from '@gauzy/ui-config';
import { redactUrlSecrets } from '@gauzy/ui-core/common';
import { JitsuAnalyticsEvents, JitsuAnalyticsEventsEnum } from './event.type';

@Injectable({
	providedIn: 'root'
})
export class JitsuService {
	private jitsuClient: AnalyticsInterface;

	constructor(private readonly location: Location, private readonly router: Router) {
		this.jitsuClient =
			environment.JITSU_BROWSER_URL && environment.JITSU_BROWSER_WRITE_KEY
				? jitsuAnalytics({
						host: environment.JITSU_BROWSER_URL,
						writeKey: environment.JITSU_BROWSER_WRITE_KEY,
						debug: false,
						echoEvents: false
				  })
				: emptyAnalytics;
	}

	async identify(id?: string | object, traits?: Record<string, any> | Function | null): Promise<any> {
		return await this.jitsuClient.identify(id, traits);
	}

	trackPageViews() {
		this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
			const path = this.location.path();
			// An emailed link's token (account deletion, password reset, invitation) must never reach analytics.
			// Such a page view is not sent at all: the Jitsu client also builds its own page context from
			// `window.location`, so redacting the path passed here would not be enough.
			if (carriesUrlSecret(path) || carriesUrlSecret(window.location.href)) {
				return;
			}
			this.page(JitsuAnalyticsEventsEnum.PAGE_VIEW, path);
		});
	}

	async trackEvents(event: string, properties?: Record<string, any> | null | JitsuAnalyticsEvents): Promise<any> {
		return await this.jitsuClient.track(event, properties);
	}

	async page(name: string, url: string): Promise<any> {
		return await this.jitsuClient.page({
			name: name,
			path: url,
			environment: window.navigator.platform,
			context: {
				page: {
					url: url
				}
			}
		});
	}

	// this deletes the data store
	async reset(): Promise<any> {
		return await this.jitsuClient.reset();
	}

	async group(id: string | object, traits?: Record<string, any> | null): Promise<any> {
		return await this.jitsuClient.group(id, traits);
	}
}

/** Whether a URL carries a `token` / `code` parameter (what {@link redactUrlSecrets} would redact). */
function carriesUrlSecret(url: string): boolean {
	return !!url && redactUrlSecrets(url) !== url;
}
