import { ModuleWithProviders, NgModule } from '@angular/core';
import { ColorPickerService } from 'ngx-color-picker';
import { NgxPermissionsModule } from 'ngx-permissions';

@NgModule({
	imports: [NgxPermissionsModule.forRoot()],
	declarations: [],
	exports: []
})
export class UiSdkModule {
	/**
	 * Returns a ModuleWithProviders object for the UiSdkModule.
	 *
	 * @return {ModuleWithProviders<UiSdkModule>} The ModuleWithProviders object containing the UiSdkModule and an empty providers array.
	 */
	static forRoot(): ModuleWithProviders<UiSdkModule> {
		return {
			ngModule: UiSdkModule,
			providers: [ColorPickerService]
		};
	}
}
