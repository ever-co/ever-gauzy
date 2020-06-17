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
} from '@nebular/theme';
import { PipelinesRouting } from './pipelines.routing';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { PipelinesService } from '../../@core/services/pipelines.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { PipelineFormComponent } from './pipeline-form/pipeline-form.component';
import { StageFormComponent } from './stage-form/stage-form.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

@NgModule( {
  declarations: [
    PipelineFormComponent,
    PipelinesComponent,
    StageFormComponent,
  ],
  exports: [
    PipelineFormComponent,
    PipelinesComponent,
    StageFormComponent,
  ],
  providers: [
    PipelinesService,
  ],
  imports: [
    NbDialogModule.forChild(),
    ReactiveFormsModule,
    Ng2SmartTableModule,
    NbAccordionModule,
    NbFormFieldModule,
    PipelinesRouting,
    TranslateModule,
    DragDropModule,
    NbButtonModule,
    NbSelectModule,
    NbInputModule,
    CommonModule,
    NbCardModule,
    NbIconModule,
    FormsModule,
  ],
})
export class PipelinesModule
{
}
