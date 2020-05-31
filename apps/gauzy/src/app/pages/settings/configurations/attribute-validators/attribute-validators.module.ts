import { NgModule } from '@angular/core';
import { AttributeValidatorsComponent } from './attribute-validators.component';
import { AttributeValidatorsService } from '../../../../@core/services/attribute-validators.service';
import { CommonModule } from '@angular/common';
import { AttributeValidatorsRoutingModule } from './attribute-validators.routing.module';
import { NbAccordionModule, NbCardModule, NbInputModule, NbToggleModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { TranslateModule } from '@ngx-translate/core';



@NgModule( {
  imports: [
    AttributeValidatorsRoutingModule,
    MonacoEditorModule,
    NbAccordionModule,
    TranslateModule,
    NbInputModule,
    NbCardModule,
    CommonModule,
    FormsModule,
    NbToggleModule,
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
