import {Injector, NgModule} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	GAUZY_ENV,
	ServerConnectionService,
	Store,
} from '..';
import { Router } from '@angular/router';

@NgModule({
	imports: [
		CommonModule
	]
})
export class DesktopUiLibModule {}

export function serverConnectionFactory(
	provider: ServerConnectionService,
	store: Store,
	router: Router,
	injector: Injector
) {
	const environment: any = injector.get(GAUZY_ENV);
	return () => {
		return provider
			.checkServerConnection(environment.API_BASE_URL)
			.finally(() => {
				// if (store.serverConnection !== 200) {
				// 	router.navigate(['server-down']);
				// }
			})
			.catch(() => { });
		// return true;
	};
}
