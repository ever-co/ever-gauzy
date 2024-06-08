import { ModuleWithProviders, NgModule } from '@angular/core';

@NgModule({
	imports: [],
	declarations: [],
	exports: []
})
export class CommonModule {
	/**
	 * Returns a ModuleWithProviders object that specifies the CommonModule and its providers.
	 *
	 * @return {ModuleWithProviders<CommonModule>} A ModuleWithProviders object with the CommonModule and its providers.
	 */
	static forRoot(): ModuleWithProviders<CommonModule> {
		return {
			ngModule: CommonModule,
			providers: []
		};
	}
}
