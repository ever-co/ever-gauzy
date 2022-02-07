import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GauzyRangePickerComponent } from './gauzy-range-picker.component';
import { SharedModule } from '../../shared.module';
import { FormsModule } from '@angular/forms';
import { NgxDaterangepickerMd } from 'ngx-daterangepicker-material';
import { NbButtonModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';



@NgModule({
  declarations: [
    GauzyRangePickerComponent
  ],
  exports: [GauzyRangePickerComponent],
  imports: [
    CommonModule,
    SharedModule,
    FormsModule,
    NgxDaterangepickerMd,
    NbInputModule,
    NbButtonModule,
    TranslateModule,
    NbIconModule
  ]
})
export class GauzyRangePickerModule { }
