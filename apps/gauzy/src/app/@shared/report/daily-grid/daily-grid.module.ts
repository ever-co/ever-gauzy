import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyGridComponent } from './daily-grid.component';
import { FormsModule } from '@angular/forms';
import {
	NbIconModule,
	NbSpinnerModule,
	NbCardModule,
	NbSelectModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { FiltersModule } from '../../timesheet/filters/filters.module';
import { ReportTableUserAvatarModule } from "../report-table-user-avatar/report-table-user-avatar.module";
import { OrganizationModule } from "../organization/organization.module";

@NgModule({
	declarations: [DailyGridComponent],
	exports: [DailyGridComponent],
	imports: [
		CommonModule,
		SharedModule,
		TranslateModule,
		NbIconModule,
		NbSpinnerModule,
		NbCardModule,
		FiltersModule,
		NbSelectModule,
		FormsModule,
		ReportTableUserAvatarModule,
		OrganizationModule,
	],
})
export class DailyGridModule {}
