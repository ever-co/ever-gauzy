import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
	declarations: [],
	imports: [CommonModule],
	exports: [],
	providers: []
})
export class UiConfigModule {
	static forRoot(): ModuleWithProviders<UiConfigModule> {
		return {
			ngModule: UiConfigModule,
			providers: []
		};
	}
}
