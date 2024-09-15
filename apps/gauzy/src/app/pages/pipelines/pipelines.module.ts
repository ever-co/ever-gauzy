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
import { TranslateModule } from '@ngx-translate/core';
import { SmartDataViewLayoutModule, CardGridModule, SharedModule } from '@gauzy/ui-core/shared';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { StageFormComponent } from './stage-form/stage-form.component';
import { DealsService, PipelinesService } from '@gauzy/ui-core/core';
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
	imports: [
		CommonModule,
		ReactiveFormsModule,
		NbDialogModule.forChild(),
		NbAccordionModule,
		NbFormFieldModule,
		NbSpinnerModule,
		PipelinesRouting,
		TranslateModule.forChild(),
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
		SmartDataViewLayoutModule,
		NbTabsetModule
	],
	providers: [PipelinesService, DealsService]
})
export class PipelinesModule {}
