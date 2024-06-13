import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
	NbSpinnerModule,
	NbTabsetModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { CardGridModule, GauzyButtonActionModule, PaginationV2Module, SharedModule } from '@gauzy/ui-sdk/shared';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Angular2SmartTableModule } from 'angular2-smart-table';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { StageFormComponent } from './stage-form/stage-form.component';
import { DealsService, PipelinesService } from '@gauzy/ui-sdk/core';
import { PipelineDealsComponent } from './pipeline-deals/pipeline-deals.component';
import { PipelineDealFormComponent } from './pipeline-deals/pipeline-deal-form/pipeline-deal-form.component';
import { PipelineDealExcerptComponent } from './table-components/pipeline-deal-excerpt/pipeline-deal-excerpt.component';
import { PipelineDealProbabilityComponent } from './table-components/pipeline-deal-probability/pipeline-deal-probability.component';
import { StageComponent } from './stage/stage.component';
import { PipelinesRouting } from './pipelines.routing';
import { PipelinesComponent } from './pipelines.component';

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
		CommonModule,
		ReactiveFormsModule,
		NbDialogModule.forChild(),
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
