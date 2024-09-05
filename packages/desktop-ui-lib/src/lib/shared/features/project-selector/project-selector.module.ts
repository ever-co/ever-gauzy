import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ProjectSelectorComponent } from './project-selector.component';

@NgModule({
	declarations: [ProjectSelectorComponent],
	exports: [ProjectSelectorComponent],
	imports: [CommonModule]
})
export class ProjectSelectorModule {}
