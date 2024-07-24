import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NbBadgeModule, NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { ComponentsModule } from './components/components.module';
import { DirectivesModule } from './directives/directives.module';
import { PipesModule } from './pipes/pipes.module';

const IMPORTS_EXPORTS = [ComponentsModule, DirectivesModule, PipesModule];

@NgModule({
	declarations: [],
	imports: [
		CommonModule,
		RouterModule,
		NbBadgeModule,
		NbButtonModule,
		NbIconModule,
		NbTooltipModule,
		TranslateModule,
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
