import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';
import { Pipes } from './pipes';

@NgModule({
	declarations: [...Pipes],
	imports: [CommonModule, BackNavigationModule],
	exports: [BackNavigationModule, ...Pipes]
})
export class SharedModule {
	static forRoot(): ModuleWithProviders {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
