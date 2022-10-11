import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';
import { Pipes } from './pipes';
import { Components } from './components';
import { RouterModule } from '@angular/router';
import { AlertModalModule } from './alert-modal';
import { NgxPermissionsModule } from 'ngx-permissions';
import { DirectivesModule } from "./directives/directives.module";

const Modules = [NgxPermissionsModule, BackNavigationModule, DirectivesModule];

@NgModule({
	declarations: [...Pipes, ...Components],
	imports: [CommonModule, RouterModule, ...Modules],
	exports: [
		AlertModalModule,
		...Pipes,
		...Components,
		...Modules
	],
	providers: [...Pipes]
})
export class SharedModule {
	static forRoot(): ModuleWithProviders<SharedModule> {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
