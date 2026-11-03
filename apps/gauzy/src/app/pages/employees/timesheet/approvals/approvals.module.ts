// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
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
	NbCheckboxModule,
	NbTooltipModule
} from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { SmartDataViewLayoutModule, SharedModule } from '@gauzy/ui-core/shared';
import { TranslatePipe } from '@ngx-translate/core';
import { ApprovalsRoutingModule } from './approvals-routing.module';
import { ApprovalsComponent } from './approvals/approvals.component';

@NgModule({
	declarations: [ApprovalsComponent],
	imports: [
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
		TranslatePipe,
		MomentModule,
		SharedModule,
		ApprovalsRoutingModule,
		SmartDataViewLayoutModule
	]
})
export class ApprovalsModule {}
