import { ModuleWithProviders, NgModule } from '@angular/core';
import { NgxPermissionsModule } from 'ngx-permissions';

@NgModule({
	imports: [NgxPermissionsModule.forRoot()],
	declarations: [],
	exports: []
})
export class UiCoreModule {
	/**
	 * Returns a ModuleWithProviders object for the UiCoreModule.
	 *
	 * @return {ModuleWithProviders<UiCoreModule>}
	 */
	static forRoot(): ModuleWithProviders<UiCoreModule> {
		return {
			ngModule: UiCoreModule,
			providers: []
		};
	}
}
