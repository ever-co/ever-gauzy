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
	NbSpinnerModule,
	NbCheckboxModule
} from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { SmartDataViewLayoutModule, SharedModule, StatusBadgeModule } from '@gauzy/ui-core/shared';
import { TranslateModule } from '@ngx-translate/core';
import { ApprovalsRoutingModule } from './approvals-routing.module';
import { ApprovalsComponent } from './approvals/approvals.component';

@NgModule({
	declarations: [ApprovalsComponent],
	imports: [
		CommonModule,
		FormsModule,
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
		TranslateModule.forChild(),
		MomentModule,
		SharedModule,
		ApprovalsRoutingModule,
		StatusBadgeModule,
		SmartDataViewLayoutModule
	]
})
export class ApprovalsModule {}
