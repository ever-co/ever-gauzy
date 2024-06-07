import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule, NbCardModule, NbListModule, NbDialogModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { Store } from '@gauzy/ui-sdk/common';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';
import { ThemeModule } from '../../../@theme/theme.module';
import { GauzyEditableGridComponent } from './gauzy-editable-grid.component';

const NbModules = [NbButtonModule, NbIconModule, NbCardModule, NbListModule, NbDialogModule.forChild()];

const OtherModules = [GauzyButtonActionModule];

@NgModule({
	imports: [ThemeModule, ...NbModules, ...OtherModules, I18nTranslateModule.forChild()],
	declarations: [GauzyEditableGridComponent],
	exports: [GauzyEditableGridComponent],
	providers: [Store]
})
export class GauzyEditableGridModule {}
