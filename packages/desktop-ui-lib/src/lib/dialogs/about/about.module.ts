import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AboutComponent } from './about.component';
import { NbButtonModule, NbCardModule } from '@nebular/theme';



@NgModule({
  declarations: [
    AboutComponent
  ],
  imports: [
    CommonModule,
    NbCardModule,
    NbButtonModule
  ]
})
export class AboutModule { }
