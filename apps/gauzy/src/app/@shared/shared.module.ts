import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';
import { Pipes } from './pipes';
import { Components } from './components';
import { RouterModule } from '@angular/router';
import { AlertModalModule } from './alert-modal/alert-modal.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { Directives } from './directives';

const Modules = [NgxPermissionsModule, BackNavigationModule];

@NgModule({
	declarations: [...Pipes, ...Components, ...Directives],
	imports: [CommonModule, RouterModule, ...Modules],
	exports: [
		AlertModalModule,
		...Pipes,
		...Components,
		...Modules,
		...Directives
	]
})
export class SharedModule {
	static forRoot(): ModuleWithProviders<SharedModule> {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
