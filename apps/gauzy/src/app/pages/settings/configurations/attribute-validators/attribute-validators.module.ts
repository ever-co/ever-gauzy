import { NgModule } from '@angular/core';
import { AttributeValidatorsComponent } from './attribute-validators.component';
import { AttributeValidatorsService } from '../../../../@core/services/attribute-validators.service';
import { CommonModule } from '@angular/common';
import { AttributeValidatorsRoutingModule } from './attribute-validators.routing.module';
import { NbAccordionModule, NbActionsModule, NbCardModule, NbInputModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { TranslateModule } from '@ngx-translate/core';



@NgModule( {
  imports: [
    AttributeValidatorsRoutingModule,
    NbAccordionModule,
    NbCardModule,
    CommonModule,
    FormsModule,
    MonacoEditorModule,
    NbInputModule,
    TranslateModule,
    NbActionsModule,
  ],
  declarations: [
    AttributeValidatorsComponent,
  ],
  providers: [
    AttributeValidatorsService,
  ],
})
export class AttributeValidatorsModule
{
  //
}
