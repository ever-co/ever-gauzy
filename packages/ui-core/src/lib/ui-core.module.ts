import { ModuleWithProviders, NgModule } from '@angular/core';
import { ColorPickerService } from 'ngx-color-picker';
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
	 * @return {ModuleWithProviders<UiCoreModule>} The ModuleWithProviders object containing the UiCoreModule and an empty providers array.
	 */
	static forRoot(): ModuleWithProviders<UiCoreModule> {
		return {
			ngModule: UiCoreModule,
			providers: [ColorPickerService]
		};
	}
}
