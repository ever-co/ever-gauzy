import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

import { enableAkitaProdMode, persistState } from '@datorama/akita';
import { akitaConfig } from '@datorama/akita';
import * as Sentry from '@sentry/angular';
import { BrowserTracing } from '@sentry/tracing';

if (environment.production) {
	enableProdMode();
	enableAkitaProdMode();
}

persistState({
	key: '_gauzyStore'
});

akitaConfig({
	resettable: true
});

Sentry.init({
	dsn: environment.SENTRY_DSN,
	integrations: [
		// Registers and configures the Tracing integration,
		// which automatically instruments your application to monitor its
		// performance, including custom Angular routing instrumentation
		new BrowserTracing({
			tracePropagationTargets: ['localhost'],
			routingInstrumentation: Sentry.routingInstrumentation
		})
	],

	// Set tracesSampleRate to 1.0 to capture 100%
	// of transactions for performance monitoring.
	// We recommend adjusting this value in production
	tracesSampleRate: 1.0
});

platformBrowserDynamic()
	.bootstrapModule(AppModule)
	.then((success) => console.log(`Bootstrap success`))
	.catch((err) => console.error(err));
