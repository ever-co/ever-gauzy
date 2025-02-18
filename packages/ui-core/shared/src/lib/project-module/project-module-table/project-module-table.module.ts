import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSpinnerModule } from '@nebular/theme';
import { SmartDataViewLayoutModule } from '../../smart-data-layout';
import { ProjectModuleTableComponent } from './project-module-table.component';
import { ProjectModuleMutationModule } from '../project-module-mutation/project-module-mutation.module';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [ProjectModuleTableComponent],
	exports: [ProjectModuleTableComponent],
	imports: [
		CommonModule,
		NbSpinnerModule,
		ProjectModuleMutationModule,
		SmartDataViewLayoutModule,
		TranslateModule.forChild()
	]
})
export class ProjectModuleTableModule {}
