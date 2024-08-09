import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DateTimePipe } from './date-time.pipe';
import { DurationFormatPipe } from './duration-format.pipe';
import { HumanizePipe } from './humanize.pipe';
import { ReplacePipe } from './replace.pipe';

const pipes = [DateTimePipe, DurationFormatPipe, HumanizePipe, ReplacePipe];
@NgModule({
	declarations: [...pipes],
	imports: [CommonModule],
	exports: [...pipes]
})
export class PipeModule {}
