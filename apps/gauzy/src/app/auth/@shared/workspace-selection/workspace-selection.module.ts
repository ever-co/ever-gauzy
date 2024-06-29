import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbListModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { SharedModule } from '@gauzy/ui-core/shared';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { WorkspaceSelectionComponent } from './workspace-selection.component';

@NgModule({
	imports: [
		CommonModule,
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbListModule,
		I18nTranslateModule.forChild(),
		SharedModule
	],
	declarations: [WorkspaceSelectionComponent],
	exports: [WorkspaceSelectionComponent],
	providers: []
})
export class WorkspaceSelectionModule {}
