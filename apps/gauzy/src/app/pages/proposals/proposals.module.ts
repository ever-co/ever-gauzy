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
import { NgChartsModule } from 'ng2-charts';
import { NgxPermissionsModule } from 'ngx-permissions';
import { CKEditorModule } from 'ckeditor4-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { ProposalsService } from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	ContactSelectModule,
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
		TranslateModule.forChild(),
		SharedModule,
		TagsColorInputModule,
		TableComponentsModule,
		UserFormsModule,
		CardGridModule,
		ProposalTemplateSelectModule,
		SmartDataViewLayoutModule,
		ContactSelectModule,
		TableFiltersModule,
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
export class ProposalsModule {}
