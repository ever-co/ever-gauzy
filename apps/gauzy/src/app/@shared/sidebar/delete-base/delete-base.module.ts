import { DeleteBaseComponent } from './delete-base.component';
import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [ThemeModule, NbCardModule, NbIconModule, NbButtonModule, I18nTranslateModule.forChild()],
	declarations: [DeleteBaseComponent],
	exports: [DeleteBaseComponent]
})
export class DeleteBaseModule {}
