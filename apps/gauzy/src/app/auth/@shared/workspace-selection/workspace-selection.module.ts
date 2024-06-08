import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule, NbListModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from './../../../@theme/theme.module';
import { SharedModule } from './../../../@shared/shared.module';
import { WorkspaceSelectionComponent } from './workspace-selection.component';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbIconModule,
		NbListModule,
		I18nTranslateModule.forChild(),
		ThemeModule,
		SharedModule
	],
	declarations: [WorkspaceSelectionComponent],
	exports: [WorkspaceSelectionComponent],
	providers: []
})
export class WorkspaceSelectionModule {}
