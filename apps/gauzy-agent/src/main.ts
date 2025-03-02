
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { akitaConfig, enableAkitaProdMode, persistState } from '@datorama/akita';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

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

platformBrowserDynamic()
	.bootstrapModule(AppModule, {
		preserveWhitespaces: false
	})
	.then(() => console.log(`Bootstrap Success!`))
	.catch((error) => console.error(error));

// import { bootstrapApplication } from '@angular/platform-browser';
// import { appConfig } from './app/app.config';
// import { AppComponent } from './app/app.component';
//
// bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
