import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';



@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: 'attribute-validators',
        loadChildren: () =>
          import( './attribute-validators/attribute-validators.module' ).then(
            ({ AttributeValidatorsModule }) => AttributeValidatorsModule
          ),
      },
    ]),
  ],
  exports: [
    RouterModule,
  ],
})
export class ConfigurationsRoutingModule
{
}
