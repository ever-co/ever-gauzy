import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { NodataComponent } from './no-data.component';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { TranslateModule } from '../translate/translate.module';


@NgModule({
  declarations: [
    NodataComponent
  ],
  exports:[
    NodataComponent
  ],
  imports: [
    TranslateModule,
    CommonModule,
    NbCardModule,
    NbIconModule,
    NbEvaIconsModule
  ]
})
export class NodataModule { }
