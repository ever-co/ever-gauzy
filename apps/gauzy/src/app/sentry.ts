import * as Sentry from '@sentry/angular';
import { Client, ClientOptions, BaseTransportOptions } from '@sentry/core';
import { environment } from '@gauzy/ui-config';
import { redactUrlSecrets } from '@gauzy/ui-core/common';
import { version } from '../../version';

/**
 * Initializes and configures the Sentry module.
 * @returns The configured Sentry instance.
 */
export function initializeSentry(): Client<ClientOptions<BaseTransportOptions>> {
	// Session Replay records the page's initial URL, fragment included, and that recording goes through neither
	// `beforeSend` nor `beforeBreadcrumb`. An emailed link (account deletion, password reset, invitation) carries its
	// single-use token there (`#/auth/delete-account/confirm?token=…`), so a page load that starts on such a URL
	// gets no Replay at all (the same test as `redactUrlSecrets`). The next page load records again as usual.
	const loadedWithUrlSecret =
		typeof window !== 'undefined' && /[?&#](token|code)=/i.test(window.location?.href ?? '');

	const replay = loadedWithUrlSecret ? null : Sentry.replayIntegration();
	// An emailed link opened in a tab already running the app is a same-document navigation (hash routing): no page
	// load, so the check above never sees it. Stop Replay for good the moment the URL carries a secret.
	if (replay && typeof window !== 'undefined') {
		const stopOnSecret = () => {
			if (/[?&#](token|code)=/i.test(window.location?.href ?? '')) {
				// `flush: false`: the pending segment may already hold the new URL, so it must not be sent either.
				void replay.stop({ flush: false });
			}
		};
		window.addEventListener('hashchange', stopOnSecret);
		window.addEventListener('popstate', stopOnSecret);
	}

	return Sentry.init({
		// Sentry 11 replaced `sendDefaultPii` with `dataCollection`, whose defaults now send cookies, request and
		// response bodies, user info and more. This is the migration guide's "keep the v10 default" baseline, so the
		// upgrade collects nothing it did not collect before (and `attachStacktrace`, now true by default, stays off).
		// https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md
		dataCollection: {
			userInfo: false,
			cookies: false,
			httpHeaders: {
				request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
				response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] }
			},
			httpBodies: [],
			urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
			genAI: { inputs: false, outputs: false },
			databaseQueryData: false,
			queues: false,
			graphQL: { document: false, variables: false }
		},
		attachStacktrace: false,
		// Emailed links (account deletion, password reset, invitations) carry a single-use token in the URL; with
		// hash routing it sits in the fragment, which Sentry records verbatim in `request.url` and in navigation
		// breadcrumbs. Redact it before anything leaves the browser.
		beforeBreadcrumb(breadcrumb) {
			if (breadcrumb?.data) {
				for (const key of ['from', 'to', 'url']) {
					breadcrumb.data[key] = redactUrlSecrets(breadcrumb.data[key]);
				}
			}
			return breadcrumb;
		},
		beforeSend(event) {
			if (event.request?.url) {
				event.request.url = redactUrlSecrets(event.request.url);
			}
			return event;
		},
		dsn: environment.SENTRY_DSN,
		environment: environment.production ? 'production' : 'development',
		debug: !environment.production,
		integrations: [
			// Registers and configures the Tracing integration,
			// which automatically instruments your application to monitor its
			// performance, including custom Angular routing instrumentation
			Sentry.browserTracingIntegration(),
			// Registers the Replay integration,
			// which automatically captures Session Replays (not when the page loaded with a token in its URL, above)
			...(replay ? [replay] : [])
		],

		// Set `tracePropagationTargets` to control for which URLs distributed tracing should be enabled
		tracePropagationTargets: [
			'localhost',
			/^https:\/\/api\.gauzy\.co\/api/,
			/^https:\/\/apistage\.gauzy\.co\/api/,
			/^https:\/\/apidemo\.gauzy\.co\/api/
		],

		// Capture Replay for 10% of all sessions,
		// plus for 100% of sessions with an error
		replaysSessionSampleRate: environment.SENTRY_TRACES_SAMPLE_RATE
			? parseInt(environment.SENTRY_TRACES_SAMPLE_RATE)
			: 0.01,
		replaysOnErrorSampleRate: 1.0,
		release: 'gauzy@' + version,
		// set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring
		tracesSampleRate: environment.SENTRY_TRACES_SAMPLE_RATE ? parseInt(environment.SENTRY_TRACES_SAMPLE_RATE) : 0.01
	});
}
