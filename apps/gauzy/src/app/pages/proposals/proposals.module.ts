import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbIconModule,
	NbSpinnerModule,
	NbDatepickerModule,
	NbDialogModule,
	NbBadgeModule,
	NbTooltipModule
} from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProposalsComponent } from './proposals.component';
import { ProposalsRoutingModule } from './proposals-routing.module';
import { ProposalRegisterComponent } from './proposal-register/proposal-register.component';
import { EmployeeSelectorsModule } from '../../@theme/components/header/selectors/employee/employee.module';
import { ProposalsService } from '@gauzy/ui-sdk/core';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { CKEditorModule } from 'ckeditor4-angular';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { ProposalStatusComponent } from './table-components/proposal-status/proposal-status.component';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { ProposalDetailsComponent } from './proposal-details/proposal-details.component';
import { ProposalEditComponent } from './proposal-edit/proposal-edit.component';
import { ProposalsPieChartComponent } from './proposals-pie-chart/proposals-pie-chart.component';
import { NgChartsModule } from 'ng2-charts';
import { JobTitleComponent } from './table-components/job-title/job-title.component';
import { SharedModule } from '../../@shared/shared.module';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { NgxPermissionsModule } from 'ngx-permissions';
import { ProposalTemplateSelectModule } from '../../@shared/proposal-template-select/proposal-template-select.module';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { ContactSelectModule } from '../../@shared/contact-select/contact-select.module';
import { TableFiltersModule } from '../../@shared/table-filters/table-filters.module';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';

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
		NbTooltipModule,
		EmployeeSelectorsModule,
		NgSelectModule,
		Angular2SmartTableModule,
		UserFormsModule,
		CKEditorModule,
		NgChartsModule,
		CardGridModule,
		I18nTranslateModule.forChild(),
		NgxPermissionsModule.forChild(),
		ProposalTemplateSelectModule,
		PaginationV2Module,
		ContactSelectModule,
		TableFiltersModule,
		GauzyButtonActionModule
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
