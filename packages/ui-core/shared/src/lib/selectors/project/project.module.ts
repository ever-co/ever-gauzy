import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ProjectSelectorComponent } from './project/project.component';

@NgModule({
	imports: [CommonModule, FormsModule, NbSelectModule, NgSelectModule, I18nTranslateModule.forChild()],
	declarations: [ProjectSelectorComponent],
	exports: [ProjectSelectorComponent]
})
export class ProjectSelectModule {}
