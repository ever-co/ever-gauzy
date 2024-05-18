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
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Angular2SmartTableModule } from 'angular2-smart-table';
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
import { PaginationV2Module } from '../../@shared/pagination/pagination-v2/pagination-v2.module';
import { DealsService, PipelinesService } from '../../@core/services';
import { GauzyButtonActionModule } from '../../@shared/gauzy-button-action/gauzy-button-action.module';
import { StageComponent } from './stage/stage.component';
import { NbTabsetModule } from '@nebular/theme';

@NgModule({
	declarations: [
		PipelineDealExcerptComponent,
		PipelineDealProbabilityComponent,
		PipelineDealFormComponent,
		PipelineDealsComponent,
		PipelineFormComponent,
		PipelinesComponent,
		StageFormComponent,
		StageComponent
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
		Angular2SmartTableModule,
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
		PaginationV2Module,
		GauzyButtonActionModule,
		NbTabsetModule
	]
})
export class PipelinesModule {}
