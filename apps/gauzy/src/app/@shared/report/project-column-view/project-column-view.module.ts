import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { ProjectColumnViewComponent } from './project-column-view.component';

@NgModule({
	declarations: [ProjectColumnViewComponent],
	exports: [ProjectColumnViewComponent],
	imports: [CommonModule, SharedModule, TranslateModule.forChild()]
})
export class ProjectColumnViewModule {}
