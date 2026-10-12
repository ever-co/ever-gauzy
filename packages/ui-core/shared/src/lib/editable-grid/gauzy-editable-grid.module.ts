import { NgModule } from '@angular/core';
import { NbButtonModule, NbIconModule, NbCardModule, NbListModule, NbDialogModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { GauzyEditableGridComponent } from './gauzy-editable-grid.component';
import { GauzyButtonActionModule } from '../gauzy-button-action';

const NbModules = [NbButtonModule, NbIconModule, NbCardModule, NbListModule, NbDialogModule.forChild()];
const OtherModules = [GauzyButtonActionModule];

@NgModule({
	imports: [...NbModules, ...OtherModules, TranslatePipe],
	declarations: [GauzyEditableGridComponent],
	exports: [GauzyEditableGridComponent]
})
export class GauzyEditableGridModule {}
