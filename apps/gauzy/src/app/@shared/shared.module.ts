import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';
import { Pipes } from './pipes';
import { Components } from './components';
import { RouterModule } from '@angular/router';
import { AlertModalModule } from './alert-modal/alert-modal.module';

@NgModule({
	declarations: [...Pipes, ...Components],
	imports: [CommonModule, BackNavigationModule, RouterModule],
	exports: [AlertModalModule, BackNavigationModule, ...Pipes, ...Components]
})
export class SharedModule {
	static forRoot(): ModuleWithProviders<SharedModule> {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
