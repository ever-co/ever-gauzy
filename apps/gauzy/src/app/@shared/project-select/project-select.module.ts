import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectSelectorComponent } from './project/project.component';

@NgModule({
	declarations: [ProjectSelectorComponent],
	exports: [ProjectSelectorComponent],
	imports: [CommonModule, NgSelectModule, FormsModule, TranslateModule]
})
export class ProjectSelectModule {}
