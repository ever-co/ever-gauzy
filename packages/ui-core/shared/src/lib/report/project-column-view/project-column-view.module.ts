import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { ProjectColumnViewComponent } from './project-column-view.component';

@NgModule({
	imports: [CommonModule, TranslateModule.forChild(), SharedModule],
	declarations: [ProjectColumnViewComponent],
	exports: [ProjectColumnViewComponent]
})
export class ProjectColumnViewModule {}
