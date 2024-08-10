// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbCheckboxModule,
	NbButtonModule,
	NbSelectModule,
	NbDatepickerModule,
	NbContextMenuModule,
	NbIconModule,
	NbDialogModule,
	NbSpinnerModule,
	NbPopoverModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import {
	DialogsModule,
	EditTimeLogModalModule,
	GauzyFiltersModule,
	SmartDataViewLayoutModule,
	SharedModule,
	TableComponentsModule,
	TaskSelectModule,
	TimerPickerModule,
	ViewTimeLogModalModule,
	ViewTimeLogModule
} from '@gauzy/ui-core/shared';
import { NgxPermissionsModule } from 'ngx-permissions';
import { DailyRoutingModule } from './daily-routing.module';
import { DailyComponent } from './daily/daily.component';

@NgModule({
	declarations: [DailyComponent],
	imports: [
		DailyRoutingModule,
		NbButtonModule,
		NbCardModule,
		NbCheckboxModule,
		NbContextMenuModule,
		NbDatepickerModule,
		NbDialogModule,
		NbIconModule,
		NbPopoverModule,
		NbSelectModule,
		NbSpinnerModule,
		NbTooltipModule,
		NgxPermissionsModule.forChild(),
		TranslateModule.forChild(),
		SharedModule,
		TimerPickerModule,
		TaskSelectModule,
		EditTimeLogModalModule,
		ViewTimeLogModalModule,
		GauzyFiltersModule,
		ViewTimeLogModule,
		DialogsModule,
		TableComponentsModule,
		SmartDataViewLayoutModule
	]
})
export class DailyModule {}
