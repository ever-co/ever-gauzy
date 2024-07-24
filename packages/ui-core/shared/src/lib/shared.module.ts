import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NbBadgeModule, NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ComponentsModule } from './components/components.module';
import { DirectivesModule } from './directives/directives.module';
import { PipesModule } from './pipes/pipes.module';

const IMPORTS_EXPORTS = [TranslateModule, ComponentsModule, DirectivesModule, PipesModule];

@NgModule({
	declarations: [],
	imports: [
		CommonModule,
		RouterModule,
		NbBadgeModule,
		NbButtonModule,
		NbIconModule,
		NbTooltipModule,
		NgxPermissionsModule,
		...IMPORTS_EXPORTS
	],
	exports: [...IMPORTS_EXPORTS]
})
export class SharedModule {
	/*
	 * Returns a ModuleWithProviders object for the SharedModule.
	 *
	 * @return {ModuleWithProviders<SharedModule>}
	 */
	static forRoot(): ModuleWithProviders<SharedModule> {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
