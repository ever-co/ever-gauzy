import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbSpinnerModule,
	NbDatepickerModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProposalsComponent } from './proposals.component';
import { ProposalsRoutingModule } from './proposals-routing.module';
import { ProposalRegisterComponent } from './register/proposal-register.component';
import { EmployeeSelectorsModule } from '../../@theme/components/header/selectors/employee/employee.module';
import { ProposalsService } from '../../@core/services/proposals.service';

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
		NbIconModule,
		NbSpinnerModule,
		NbDatepickerModule,
		EmployeeSelectorsModule
	],
	entryComponents: [ProposalRegisterComponent],
	declarations: [ProposalsComponent, ProposalRegisterComponent],
	providers: [ProposalsService]
})
export class ProposalsModule {}
