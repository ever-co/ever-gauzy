import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectSelectorComponent } from './project/project.component';
import { NbSelectModule } from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';

@NgModule({
	declarations: [ProjectSelectorComponent],
	exports: [ProjectSelectorComponent],
	imports: [
		CommonModule,
		NbSelectModule,
		FormsModule,
		TranslateModule,
		NgSelectModule
	]
})
export class ProjectSelectModule {}
