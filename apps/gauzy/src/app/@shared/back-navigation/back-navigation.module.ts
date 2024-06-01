import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbButtonModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { BackNavigationComponent } from './back-navigation.component';

@NgModule({
	declarations: [BackNavigationComponent],
	exports: [BackNavigationComponent],
	imports: [NbIconModule, CommonModule, NbIconModule, NbButtonModule, I18nTranslateModule.forChild()]
})
export class BackNavigationModule {}
