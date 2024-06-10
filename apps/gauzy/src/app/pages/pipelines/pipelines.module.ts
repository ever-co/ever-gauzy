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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { StageFormComponent } from './stage-form/stage-form.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { PipelineDealsComponent } from './pipeline-deals/pipeline-deals.component';
import { PipelineDealFormComponent } from './pipeline-deals/pipeline-deal-form/pipeline-deal-form.component';
import { CardGridModule } from '../../@shared/card-grid/card-grid.module';
import { SharedModule } from '../../@shared/shared.module';
import { PipelineDealExcerptComponent } from './table-components/pipeline-deal-excerpt/pipeline-deal-excerpt.component';
import { PipelineDealProbabilityComponent } from './table-components/pipeline-deal-probability/pipeline-deal-probability.component';
import { NgxPermissionsModule } from 'ngx-permissions';
import { PaginationV2Module } from '@gauzy/ui-sdk/shared';
import { DealsService, PipelinesService } from '@gauzy/ui-sdk/core';
import { GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';
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
		I18nTranslateModule.forChild(),
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
		SharedModule,
		NgxPermissionsModule.forChild(),
		PaginationV2Module,
		GauzyButtonActionModule,
		NbTabsetModule
	]
})
export class PipelinesModule {}
