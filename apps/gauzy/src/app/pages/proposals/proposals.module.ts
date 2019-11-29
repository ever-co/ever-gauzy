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
import { ProposalEditComponent } from './proposal-edit/proposal-edit.component';
import { ProposalsPieChartComponent } from './proposals-pie-chart/proposals-pie-chart.component';
import { ChartModule } from 'angular2-chartjs';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

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
		UserFormsModule,
		ChartModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	entryComponents: [ProposalRegisterComponent, ProposalStatusComponent],
	declarations: [
		ProposalsComponent,
		ProposalRegisterComponent,
		ProposalStatusComponent,
		ProposalDetailsComponent,
		ProposalEditComponent,
		ProposalsPieChartComponent
	],
	providers: [ProposalsService]
})
export class ProposalsModule {}
