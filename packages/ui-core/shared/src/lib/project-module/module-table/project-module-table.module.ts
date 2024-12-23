import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSpinnerModule } from '@nebular/theme';
import { SmartDataViewLayoutModule } from '../../smart-data-layout';
import { ProjectModuleTableComponent } from './project-module-table.component';

@NgModule({
	declarations: [ProjectModuleTableComponent],
	exports: [ProjectModuleTableComponent],
	imports: [CommonModule, NbSpinnerModule, SmartDataViewLayoutModule]
})
export class ProjectModuleTableModule {}
