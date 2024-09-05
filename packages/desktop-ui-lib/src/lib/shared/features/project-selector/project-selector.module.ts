import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SelectModule } from '../../components/ui/select/select.module';
import { ProjectSelectorComponent } from './project-selector.component';

@NgModule({
	declarations: [ProjectSelectorComponent],
	exports: [ProjectSelectorComponent],
	imports: [CommonModule, SelectModule]
})
export class ProjectSelectorModule {}
