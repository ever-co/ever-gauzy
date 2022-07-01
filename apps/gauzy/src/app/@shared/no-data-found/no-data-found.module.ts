import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { NodataFoundComponent } from './no-data-found.component';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { TranslateModule } from '../translate/translate.module';


@NgModule({
  declarations: [
    NodataFoundComponent
  ],
  exports:[
    NodataFoundComponent
  ],
  imports: [
    TranslateModule,
    CommonModule,
    NbCardModule,
    NbIconModule,
    NbEvaIconsModule
  ]
})
export class NodataFoundModule { }
