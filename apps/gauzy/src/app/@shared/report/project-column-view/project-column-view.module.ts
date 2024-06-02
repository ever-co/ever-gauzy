import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../shared.module';
import { ProjectColumnViewComponent } from './project-column-view.component';

@NgModule({
	declarations: [ProjectColumnViewComponent],
	exports: [ProjectColumnViewComponent],
	imports: [CommonModule, SharedModule, I18nTranslateModule.forChild()]
})
export class ProjectColumnViewModule {}
