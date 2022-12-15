import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AboutComponent } from './about.component';
import { NbButtonModule, NbCardModule, NbLayoutModule } from '@nebular/theme';



@NgModule({
  declarations: [
    AboutComponent
  ],
  imports: [
    CommonModule,
    NbCardModule,
    NbButtonModule,
    NbLayoutModule
  ]
})
export class AboutModule { }
