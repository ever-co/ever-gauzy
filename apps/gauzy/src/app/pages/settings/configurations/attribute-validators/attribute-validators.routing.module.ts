import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AttributeValidatorsComponent } from './attribute-validators.component';



@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: '',
        component: AttributeValidatorsComponent,
      },
    ]),
  ],
  exports: [
    RouterModule,
  ],
})
export class AttributeValidatorsRoutingModule
{
}

