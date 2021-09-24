import { NgModule } from '@angular/core';
import { PipelinesComponent } from './pipelines.component';
import {
	NbAccordionModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbCheckboxModule,
	NbSpinnerModule
} from '@nebular/theme';
import { PipelinesRouting } from './pipelines.routing';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { StageFormComponent } from './stage-form/stage-form.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { PipelineDealsComponent } from './pipeline-deals/pipeline-deals.component';
import { PipelineDealFormComponent } from './pipeline-deals/pipeline-deal-form/pipeline-deal-form.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { ThemeModule } from '../../@theme/theme.module';
import { BackNavigationModule } from '../../@shared/back-navigation/back-navigation.module';
import { PipelineDealExcerptComponent } from './table-components/pipeline-deal-excerpt/pipeline-deal-excerpt.component';
import { PipelineDealProbabilityComponent } from './table-components/pipeline-deal-probability/pipeline-deal-probability.component';
import { NgxPermissionsModule } from 'ngx-permissions';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { PaginationModule } from '../../@shared/pagination/pagination.module';
import { DealsService, PipelinesService } from '../../@core/services';
import { SharedModule } from '../../@shared/shared.module';

@NgModule({
	declarations: [
		PipelineDealExcerptComponent,
		PipelineDealProbabilityComponent,
		PipelineDealFormComponent,
		PipelineDealsComponent,
		PipelineFormComponent,
		PipelinesComponent,
		StageFormComponent
	],
	exports: [
		PipelineDealExcerptComponent,
		PipelineDealFormComponent,
		PipelineDealsComponent,
		PipelineFormComponent,
		PipelinesComponent,
		StageFormComponent
	],
	providers: [PipelinesService, DealsService],
	imports: [
		NbDialogModule.forChild(),
		ReactiveFormsModule,
		Ng2SmartTableModule,
		NbAccordionModule,
		NbFormFieldModule,
		NbSpinnerModule,
		PipelinesRouting,
		TranslateModule,
		DragDropModule,
		NbButtonModule,
		NbSelectModule,
		NbInputModule,
		NbCheckboxModule,
		CommonModule,
		NbCardModule,
		NbIconModule,
		FormsModule,
		CardGridModule,
		ThemeModule,
		BackNavigationModule,
		NgxPermissionsModule.forChild(),
		HeaderTitleModule,
		PaginationModule,
		SharedModule
	]
})
export class PipelinesModule {}
