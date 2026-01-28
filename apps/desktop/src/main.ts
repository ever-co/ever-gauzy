import { enableProdMode } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
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

platformBrowser()
	.bootstrapModule(AppModule)
	.catch((error) => console.error(error));
