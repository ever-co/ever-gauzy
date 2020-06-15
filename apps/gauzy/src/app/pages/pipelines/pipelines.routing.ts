import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PipelinesComponent } from './pipelines.component';

@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: '',
        component: PipelinesComponent,
      },
    ]),
  ],
  exports: [
    RouterModule,
  ],
})
export class PipelinesRouting
{
}
