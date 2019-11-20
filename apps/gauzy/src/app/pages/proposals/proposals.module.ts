import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbSpinnerModule,
	NbDatepickerModule,
	NbDialogModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProposalsComponent } from './proposals.component';
import { ProposalsRoutingModule } from './proposals-routing.module';
import { ProposalRegisterComponent } from './proposal-register/proposal-register.component';
import { EmployeeSelectorsModule } from '../../@theme/components/header/selectors/employee/employee.module';
import { ProposalsService } from '../../@core/services/proposals.service';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { ProposalStatusComponent } from './table-components/proposal-status/proposal-status.component';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { ProposalDetailsComponent } from './proposal-details/proposal-details.component';

@NgModule({
	imports: [
		ProposalsRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbInputModule,
		NbDatepickerModule,
		NbDialogModule.forChild(),
		TableComponentsModule,
		NbIconModule,
		NbSpinnerModule,
		NbDatepickerModule,
		EmployeeSelectorsModule,
		Ng2SmartTableModule,
		TableComponentsModule,
		UserFormsModule
	],
	entryComponents: [ProposalRegisterComponent, ProposalStatusComponent],
	declarations: [
		ProposalsComponent,
		ProposalRegisterComponent,
		ProposalStatusComponent,
		ProposalDetailsComponent
	],
	providers: [ProposalsService]
})
export class ProposalsModule {}
