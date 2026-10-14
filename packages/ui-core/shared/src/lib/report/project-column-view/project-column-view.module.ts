import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { ProjectColumnViewComponent } from './project-column-view.component';

@NgModule({
	imports: [CommonModule, TranslatePipe, SharedModule],
	declarations: [ProjectColumnViewComponent],
	exports: [ProjectColumnViewComponent]
})
export class ProjectColumnViewModule {}
