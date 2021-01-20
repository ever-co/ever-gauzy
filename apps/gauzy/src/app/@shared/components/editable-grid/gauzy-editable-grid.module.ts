import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbIconModule,
	NbCardModule,
	NbListModule,
	NbDialogModule
} from '@nebular/theme';
import { Store } from '../../../@core/services/store.service';
import { ThemeModule } from '../../../@theme/theme.module';
import { GauzyEditableGridComponent } from './gauzy-editable-grid.component';
import { TranslateModule } from '../../translate/translate.module';

const NbModules = [
	NbButtonModule,
	NbIconModule,
	NbCardModule,
	NbListModule,
	NbDialogModule.forChild()
];

@NgModule({
	imports: [ThemeModule, ...NbModules, TranslateModule],
	declarations: [GauzyEditableGridComponent],
	exports: [GauzyEditableGridComponent],
	entryComponents: [],
	providers: [Store]
})
export class GauzyEditableGridModule {}
