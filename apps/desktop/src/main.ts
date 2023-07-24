import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { enableAkitaProdMode, persistState } from '@datorama/akita';
import { akitaConfig } from '@datorama/akita';
import * as Sentry from '@sentry/angular';

if (environment.production) {
	enableProdMode();
	enableAkitaProdMode();
}

persistState({
	key: '_gauzyStore',
});

akitaConfig({
	resettable: true,
});

Sentry.init({
	dsn: environment.SENTRY_DSN,
	debug: !environment.production,
	environment: environment.production ? 'production' : 'development',
	integrations: [
		// Registers and configures the Tracing integration,
		// which automatically instruments your application to monitor its
		// performance, including custom Angular routing instrumentation
		new Sentry.BrowserTracing({
			tracePropagationTargets: [
				'localhost',
				'https://apidemo.gauzy.co',
				'https://apistage.gauzy.co',
				'https://api.gauzy.co',
			],
			routingInstrumentation: Sentry.routingInstrumentation,
		}),
	],

	// Set tracesSampleRate to 1.0 to capture 100%
	// of transactions for performance monitoring.
	// We recommend adjusting this value in production
	tracesSampleRate: environment.SENTRY_TRACES_SAMPLE_RATE
		? parseInt(environment.SENTRY_TRACES_SAMPLE_RATE)
		: 0.01,
});

platformBrowserDynamic()
	.bootstrapModule(AppModule)
	.catch((err) => console.error(err));
