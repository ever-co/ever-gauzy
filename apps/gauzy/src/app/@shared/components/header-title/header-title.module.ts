import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { HeaderTitleComponent } from './header-title.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [CommonModule, TranslateModule, SharedModule],
	declarations: [HeaderTitleComponent],
	exports: [HeaderTitleComponent]
})
export class HeaderTitleModule {}
