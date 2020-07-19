import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { enableAkitaProdMode, persistState } from '@datorama/akita';
import { akitaConfig } from '@datorama/akita';

if (environment.production) {
	enableProdMode();
	enableAkitaProdMode();
}

persistState({
	key: '_gauzyStore',
	exclude: ['app']
});

akitaConfig({
	resettable: true
});

platformBrowserDynamic()
	.bootstrapModule(AppModule)
	.catch((err) => console.error(err));
