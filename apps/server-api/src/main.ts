import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
	enableProdMode();
}

platformBrowser()
	.bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()], applicationProviders: [object Object],})
	.catch((err) => console.error(err));
