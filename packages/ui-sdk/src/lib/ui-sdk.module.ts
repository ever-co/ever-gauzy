import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
	declarations: [],
	imports: [CommonModule],
	exports: [],
	providers: []
})
export class UiSdkModule {
	static forRoot(): ModuleWithProviders<UiSdkModule> {
		return {
			ngModule: UiSdkModule,
			providers: []
		};
	}
}
