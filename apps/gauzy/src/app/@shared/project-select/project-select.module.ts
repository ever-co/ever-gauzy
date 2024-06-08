import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { ProjectSelectorComponent } from './project/project.component';
import { SharedModule } from '../shared.module';

@NgModule({
	declarations: [ProjectSelectorComponent],
	exports: [ProjectSelectorComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, I18nTranslateModule.forChild(), NgSelectModule, SharedModule]
})
export class ProjectSelectModule {}
