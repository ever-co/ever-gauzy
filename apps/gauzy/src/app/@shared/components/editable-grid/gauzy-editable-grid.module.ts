import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule, NbCardModule, NbListModule, NbDialogModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { Store } from '../../../@core/services/store.service';
import { ThemeModule } from '../../../@theme/theme.module';
import { GauzyEditableGridComponent } from './gauzy-editable-grid.component';
import { GauzyButtonActionModule } from '../../gauzy-button-action/gauzy-button-action.module';

const NbModules = [NbButtonModule, NbIconModule, NbCardModule, NbListModule, NbDialogModule.forChild()];

const OtherModules = [GauzyButtonActionModule];

@NgModule({
	imports: [ThemeModule, ...NbModules, ...OtherModules, I18nTranslateModule.forChild()],
	declarations: [GauzyEditableGridComponent],
	exports: [GauzyEditableGridComponent],
	providers: [Store]
})
export class GauzyEditableGridModule {}
