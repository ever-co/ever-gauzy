import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ComponentsModule } from './components/components.module';
import { DirectivesModule } from './directives/directives.module';
import { PipesModule } from './pipes/pipes.module';

const IMPORTS_EXPORTS = [
	CommonModule,
	FormsModule,
	ReactiveFormsModule,
	RouterModule,
	TranslateModule,
	NgxPermissionsModule,
	ComponentsModule,
	DirectivesModule,
	PipesModule
];

@NgModule({
	declarations: [],
	imports: [...IMPORTS_EXPORTS],
	exports: [...IMPORTS_EXPORTS]
})
export class SharedModule {
	/**
	 * Returns a ModuleWithProviders object that specifies the SharedModule and its providers.
	 *
	 * @return {ModuleWithProviders<SharedModule>} A ModuleWithProviders object with the SharedModule and its providers.
	 */
	static forRoot(): ModuleWithProviders<SharedModule> {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
