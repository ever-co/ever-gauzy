import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GauzyRangePickerComponent } from './gauzy-range-picker.component';
import { SharedModule } from '../../shared.module';
import { FormsModule } from '@angular/forms';
import { NgxDaterangepickerMd } from 'ngx-daterangepicker-material';
import { NbInputModule } from '@nebular/theme';



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
    NbInputModule
  ]
})
export class GauzyRangePickerModule { }
