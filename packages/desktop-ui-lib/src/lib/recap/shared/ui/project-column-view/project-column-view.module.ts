import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ProjectColumnViewComponent } from './project-column-view.component';

@NgModule({
    imports: [CommonModule, ProjectColumnViewComponent],
    exports: [ProjectColumnViewComponent]
})
export class ProjectColumnViewModule {}
