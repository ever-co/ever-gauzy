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
	.bootstrapModule(AppModule)
	.catch((error) => console.error(error));
