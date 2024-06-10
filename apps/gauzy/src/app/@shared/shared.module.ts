import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NbBadgeModule, NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ComponentsModule, DirectivesModule, PipesModule } from '@gauzy/ui-sdk/shared';

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
		NgxPermissionsModule.forChild(),
		I18nTranslateModule.forChild(),
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
