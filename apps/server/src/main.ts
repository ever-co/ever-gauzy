import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import * as Sentry from '@sentry/angular';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
	enableProdMode();
}

Sentry.init({
	dsn: environment.SENTRY_DSN,
	environment: environment.production ? 'production' : 'development',
	debug: !environment.production,
	integrations: [
		// Registers and configures the Tracing integration,
		// which automatically instruments your application to monitor its
		// performance, including custom Angular routing instrumentation
		new Sentry.BrowserTracing({
			tracePropagationTargets: ['localhost'],
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
