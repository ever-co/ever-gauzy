import { NgModule } from '@angular/core';
import { HttpLoaderFactory, ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbSpinnerModule,
	NbDatepickerModule,
	NbDialogModule,
	NbBadgeModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProposalsComponent } from './proposals.component';
import { ProposalsRoutingModule } from './proposals-routing.module';
import { ProposalRegisterComponent } from './proposal-register/proposal-register.component';
import { EmployeeSelectorsModule } from '../../@theme/components/header/selectors/employee/employee.module';
import { ProposalsService } from '../../@core/services/proposals.service';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { CKEditorModule } from 'ng2-ckeditor';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { ProposalStatusComponent } from './table-components/proposal-status/proposal-status.component';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { ProposalDetailsComponent } from './proposal-details/proposal-details.component';
import { ProposalEditComponent } from './proposal-edit/proposal-edit.component';
import { ProposalsPieChartComponent } from './proposals-pie-chart/proposals-pie-chart.component';
import { ChartModule } from 'angular2-chartjs';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { JobTitleComponent } from './table-components/job-title/job-title.component';
import { SharedModule } from '../../@shared/shared.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ProposalTemplateSelectModule } from '../../@shared/proposal-template-select/proposal-template-select.module';
import { NgSelectModule } from '@ng-select/ng-select';

@NgModule({
	imports: [
		TagsColorInputModule,
		SharedModule,
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
		NbBadgeModule,
		EmployeeSelectorsModule,
		NgSelectModule,
		Ng2SmartTableModule,
		UserFormsModule,
		CKEditorModule,
		ChartModule,
		CardGridModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NgxPermissionsModule.forChild(),
		ProposalTemplateSelectModule
	],
	entryComponents: [
		ProposalRegisterComponent,
		ProposalStatusComponent,
		JobTitleComponent
	],
	declarations: [
		ProposalsComponent,
		ProposalRegisterComponent,
		ProposalStatusComponent,
		ProposalDetailsComponent,
		ProposalEditComponent,
		JobTitleComponent,
		ProposalsPieChartComponent
	],
	providers: [ProposalsService]
})
export class ProposalsModule {}
