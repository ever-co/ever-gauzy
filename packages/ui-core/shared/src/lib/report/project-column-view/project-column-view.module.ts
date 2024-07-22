import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { ProjectColumnViewComponent } from './project-column-view.component';

@NgModule({
	imports: [CommonModule, I18nTranslateModule.forChild(), SharedModule],
	declarations: [ProjectColumnViewComponent],
	exports: [ProjectColumnViewComponent]
})
export class ProjectColumnViewModule {}
