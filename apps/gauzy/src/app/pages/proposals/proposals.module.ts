import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDatepickerModule,
	NbDialogModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbTooltipModule
} from '@nebular/theme';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { NgChartsModule } from 'ng2-charts';
import { NgxPermissionsModule } from 'ngx-permissions';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { ProposalsService } from '@gauzy/ui-core/core';
import {
	CardGridModule,
	ContactSelectModule,
	i4netButtonActionModule,
	PaginationV2Module,
	ProposalTemplateSelectModule,
	SelectorsModule,
	SharedModule,
	TableComponentsModule,
	TableFiltersModule,
	TagsColorInputModule,
	UserFormsModule
} from '@gauzy/ui-core/shared';
import { ProposalsComponent } from './proposals.component';
import { ProposalsRoutingModule } from './proposals-routing.module';
import { ProposalRegisterComponent } from './proposal-register/proposal-register.component';
import { ProposalStatusComponent } from './table-components/proposal-status/proposal-status.component';
import { ProposalDetailsComponent } from './proposal-details/proposal-details.component';
import { ProposalEditComponent } from './proposal-edit/proposal-edit.component';
import { ProposalsPieChartComponent } from './proposals-pie-chart/proposals-pie-chart.component';
import { JobTitleComponent } from './table-components/job-title/job-title.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		ProposalsRoutingModule,
		Angular2SmartTableModule,
		CKEditorModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbDatepickerModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbInputModule,
		NbSpinnerModule,
		NbTooltipModule,
		NgSelectModule,
		NgChartsModule,
		NgxPermissionsModule.forChild(),
		I18nTranslateModule.forChild(),
		SharedModule,
		TagsColorInputModule,
		TableComponentsModule,
		UserFormsModule,
		CardGridModule,
		ProposalTemplateSelectModule,
		PaginationV2Module,
		ContactSelectModule,
		TableFiltersModule,
		i4netButtonActionModule,
		SelectorsModule
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
export class ProposalsModule { }
