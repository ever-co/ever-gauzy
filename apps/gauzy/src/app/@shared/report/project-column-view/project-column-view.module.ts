import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { ProjectColumnViewComponent } from './project-column-view.component';

@NgModule({
	imports: [CommonModule, I18nTranslateModule.forChild(), SharedModule],
	declarations: [ProjectColumnViewComponent],
	exports: [ProjectColumnViewComponent]
})
export class ProjectColumnViewModule {}
