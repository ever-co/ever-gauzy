import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { TranslateModule } from '../translate/translate.module';
import { NoDataMessageComponent } from './no-data-message.component';


@NgModule({
  declarations: [
    NoDataMessageComponent
  ],
  exports:[
    NoDataMessageComponent
  ],
  imports: [
    TranslateModule,
    CommonModule,
    NbCardModule,
    NbIconModule,
    NbEvaIconsModule
  ]
})
export class NoDataMessageModule { }
