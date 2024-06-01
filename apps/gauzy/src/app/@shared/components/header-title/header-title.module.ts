import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleComponent } from './header-title.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [CommonModule, I18nTranslateModule.forChild(), SharedModule],
	declarations: [HeaderTitleComponent],
	exports: [HeaderTitleComponent]
})
export class HeaderTitleModule {}
