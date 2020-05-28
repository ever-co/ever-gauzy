import { NgModule } from '@angular/core';
import { AttributeValidatorsComponent } from './attribute-validators.component';
import { AttributeValidatorsService } from '../../../../@core/services/attribute-validators.service';
import { CommonModule } from '@angular/common';



@NgModule( {
  declarations: [
    AttributeValidatorsComponent,
  ],
  providers: [
    AttributeValidatorsService,
  ],
  imports: [
    CommonModule,
  ],
})
export class AttributeValidatorsModule
{
  //
}
