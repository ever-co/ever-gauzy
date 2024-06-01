import { NgModule } from '@angular/core';
import { ThemeModule } from '../../../@theme/theme.module';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { AddIconComponent } from './add-icon.component';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	imports: [ThemeModule, NbCardModule, NbIconModule, NbButtonModule, TranslateModule.forChild()],
	declarations: [AddIconComponent],
	exports: [AddIconComponent]
})
export class AddIconModule {}
