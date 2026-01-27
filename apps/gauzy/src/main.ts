import { enableProdMode } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import { akitaConfig, enableAkitaProdMode, persistState } from '@datorama/akita';
import { environment } from '@gauzy/ui-config';
import { AppModule } from './app/app.module';

console.log('Environment Mode:', environment.production ? 'Production' : 'Development');

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
	.catch((err) => console.error(err));
