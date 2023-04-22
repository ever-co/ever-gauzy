import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	ServerConnectionService,
	Store,
} from '..';
import { Router } from '@angular/router';
// @ts-ignore
import { environment } from '@env/environment';

@NgModule({
	imports: [
		CommonModule
	]
})
export class DesktopUiLibModule {}

export function serverConnectionFactory(
	provider: ServerConnectionService,
	store: Store,
	router: Router
) {
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
