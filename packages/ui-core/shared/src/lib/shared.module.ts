import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NbBadgeModule, NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ComponentsModule } from './components/components.module';
import { DirectivesModule } from './directives/directives.module';
import { PipesModule } from './pipes/pipes.module';

const MODULES = [ComponentsModule, DirectivesModule, PipesModule];

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
		...MODULES
	],
	exports: [...MODULES]
})
export class SharedModule {
	static forRoot(): ModuleWithProviders<SharedModule> {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
