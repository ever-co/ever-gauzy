import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiConfigService } from './ui-config.service';

@NgModule({
	imports: [CommonModule],
	providers: []
})
export class UiConfigModule {
	/**
	 * Returns a ModuleWithProviders object that can be used to configure the UiConfigModule.
	 *
	 * @return {ModuleWithProviders<UiConfigModule>} The ModuleWithProviders object containing the UiConfigModule and an empty providers array.
	 */
	static forRoot(): ModuleWithProviders<UiConfigModule> {
		return {
			ngModule: UiConfigModule,
			providers: [UiConfigService]
		};
	}
}
