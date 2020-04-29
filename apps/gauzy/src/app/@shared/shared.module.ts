import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';
import { Pipes } from './pipes';
import { Components } from './components';
import { RouterModule } from '@angular/router';

@NgModule({
	declarations: [...Pipes, ...Components],
	imports: [CommonModule, BackNavigationModule, RouterModule],
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
