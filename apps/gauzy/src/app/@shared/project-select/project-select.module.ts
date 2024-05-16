import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { ProjectSelectorComponent } from './project/project.component';
import { SharedModule } from '../shared.module';

@NgModule({
	declarations: [ProjectSelectorComponent],
	exports: [ProjectSelectorComponent],
	imports: [CommonModule, NbSelectModule, FormsModule, TranslateModule, NgSelectModule, SharedModule]
})
export class ProjectSelectModule {}
