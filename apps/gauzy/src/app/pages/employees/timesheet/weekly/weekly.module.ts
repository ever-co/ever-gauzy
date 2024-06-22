// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbDatepickerModule,
	NbIconModule,
	NbButtonModule,
	NbDialogModule,
	NbSpinnerModule,
	NbPopoverModule,
	NbCardModule,
	NbCheckboxModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import {
	EditTimeLogModalModule,
	i4netFiltersModule,
	NoDataMessageModule,
	SharedModule,
	TableComponentsModule,
	ViewTimeLogModule
} from '@gauzy/ui-core/shared';
import { WeeklyRoutingModule } from './weekly-routing.module';
import { WeeklyComponent } from './weekly/weekly.component';

@NgModule({
	declarations: [WeeklyComponent],
	imports: [
		CommonModule,
		WeeklyRoutingModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		NbDatepickerModule,
		NbIconModule,
		FormsModule,
		NbButtonModule,
		SharedModule,
		i4netFiltersModule,
		EditTimeLogModalModule,
		NbDialogModule,
		NbSpinnerModule,
		NbButtonModule,
		NbPopoverModule,
		ViewTimeLogModule,
		NbCardModule,
		NbCheckboxModule,
		TableComponentsModule,
		NoDataMessageModule
	]
})
export class WeeklyModule { }
