import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NbBadgeModule, NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { DirectivesModule, PipesModule } from '@gauzy/ui-sdk/shared';
import { NgxPermissionsModule } from 'ngx-permissions';
import { Components } from './components';
import { AlertModalModule } from './alert-modal';
import { TaskBadgeViewComponent } from './tasks/task-badge-view/task-badge-view.component';

const NB_MODULES = [NbBadgeModule, NbButtonModule, NbIconModule, NbTooltipModule];
const OTHER_MODULES = [NgxPermissionsModule.forChild()];
const MODULES = [DirectivesModule, PipesModule];

@NgModule({
	declarations: [...Components, TaskBadgeViewComponent],
	imports: [CommonModule, RouterModule, I18nTranslateModule.forChild(), ...NB_MODULES, ...OTHER_MODULES, ...MODULES],
	exports: [AlertModalModule, ...Components, ...MODULES, TaskBadgeViewComponent]
})
export class SharedModule {
	static forRoot(): ModuleWithProviders<SharedModule> {
		return {
			ngModule: SharedModule,
			providers: []
		};
	}
}
