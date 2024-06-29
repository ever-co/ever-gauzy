import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule, NbCardModule, NbListModule, NbDialogModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { GauzyEditableGridComponent } from './gauzy-editable-grid.component';
import { GauzyButtonActionModule } from '../gauzy-button-action';

const NbModules = [NbButtonModule, NbIconModule, NbCardModule, NbListModule, NbDialogModule.forChild()];
const OtherModules = [GauzyButtonActionModule];

@NgModule({
	imports: [...NbModules, ...OtherModules, I18nTranslateModule.forChild()],
	declarations: [GauzyEditableGridComponent],
	exports: [GauzyEditableGridComponent]
})
export class GauzyEditableGridModule {}
