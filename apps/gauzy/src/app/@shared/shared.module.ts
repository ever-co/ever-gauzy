import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationModule } from './back-navigation';
import { TimeForamtPipe } from './pipes/time-foramt.pipe';
import { Pipes } from './pipes';

console.log(Pipes);

@NgModule({
	declarations: [TimeForamtPipe, ...Pipes],
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
