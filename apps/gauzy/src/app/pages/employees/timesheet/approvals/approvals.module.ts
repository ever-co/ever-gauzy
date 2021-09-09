// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
	NbCardModule,
	NbButtonModule,
	NbSelectModule,
	NbDatepickerModule,
	NbContextMenuModule,
	NbIconModule,
	NbDialogModule,
	NbPopoverModule,
	NbSpinnerModule
} from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { SharedModule } from './../../../../@shared/shared.module';
import { FiltersModule } from './../../../../@shared/timesheet/filters/filters.module';
import { TranslateModule } from './../../../../@shared/translate/translate.module';
import { ApprovalsRoutingModule } from './approvals-routing.module';
import { ApprovalsComponent } from './approvals/approvals.component';

@NgModule({
	declarations: [ApprovalsComponent],
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbCardModule,
		NbContextMenuModule,
		NbDatepickerModule,
		NbDialogModule,
		NbIconModule,
		NbPopoverModule,
		NbSelectModule,
		NbSpinnerModule,
		TranslateModule,
		MomentModule,
		SharedModule,
		FiltersModule,
		ApprovalsRoutingModule
	]
})
export class ApprovalsModule {}
