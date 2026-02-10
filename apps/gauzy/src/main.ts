import { enableProdMode } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import { akitaConfig, enableAkitaProdMode, persistState } from '@datorama/akita';
import { environment } from '@gauzy/ui-config';
import { loadAppUIConfig } from './app/plugin-config-loader';
import { AppBootstrapModule } from './app/bootstrap.module';

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

// Load plugin configuration first, then bootstrap Angular.
loadAppUIConfig()
	.then(() => platformBrowser().bootstrapModule(AppBootstrapModule))
	.catch((err) => console.error(err));
