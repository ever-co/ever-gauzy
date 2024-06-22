import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule, NbCardModule, NbListModule, NbDialogModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { i4netEditableGridComponent } from './gauzy-editable-grid.component';
import { i4netButtonActionModule } from '../gauzy-button-action';

const NbModules = [NbButtonModule, NbIconModule, NbCardModule, NbListModule, NbDialogModule.forChild()];
const OtherModules = [i4netButtonActionModule];

@NgModule({
	imports: [...NbModules, ...OtherModules, I18nTranslateModule.forChild()],
	declarations: [i4netEditableGridComponent],
	exports: [i4netEditableGridComponent]
})
export class i4netEditableGridModule { }
