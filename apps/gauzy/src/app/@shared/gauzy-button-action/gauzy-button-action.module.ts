import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbIconModule, NbButtonModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { GauzyButtonActionComponent } from './gauzy-button-action.component';
import { SharedModule } from '../shared.module';
import { ThemeModule } from '../../@theme/theme.module';

@NgModule({
	declarations: [GauzyButtonActionComponent],
	exports: [GauzyButtonActionComponent],
	imports: [CommonModule, SharedModule, ThemeModule, NbIconModule, NbButtonModule, I18nTranslateModule.forChild()]
})
export class GauzyButtonActionModule {}
