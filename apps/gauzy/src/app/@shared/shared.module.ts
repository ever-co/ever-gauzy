import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';
import { Pipes } from './pipes';
import { Components } from './components';

@NgModule({
	declarations: [...Pipes, ...Components],
	imports: [CommonModule, BackNavigationModule],
	exports: [BackNavigationModule, ...Pipes, ...Components]
})
export class SharedModule {
	static forRoot(): ModuleWithProviders {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
