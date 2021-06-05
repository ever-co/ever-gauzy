import { DurationFormatPipe } from './duration-format.pipe';
import { FilterArrayPipe } from './filter-array.pipe';
import { Nl2BrPipe, SafeHtmlPipe, TruncatePipe } from './text.pipe';
import { ReplacePipe } from './replace.pipe';
import { TimeFormatPipe } from './time-format.pipe';
import { UtcToLocalPipe } from './utc-to-local.pipe';
import { DateTimeFormatPipe } from './datetime-format.pipe';
import { DateFormatPipe } from './date-format.pipe';

export * from './duration-format.pipe';
export * from './filter-array.pipe';
export * from './replace.pipe';
export * from './text.pipe';
export * from './time-format.pipe';
export * from './datetime-format.pipe';
export * from './date-format.pipe';
export * from './utc-to-local.pipe';

export const Pipes = [
	DurationFormatPipe,
	FilterArrayPipe,
	Nl2BrPipe,
	ReplacePipe,
	SafeHtmlPipe,
	TimeFormatPipe,
	DateTimeFormatPipe,
	DateFormatPipe,
	TruncatePipe,
	UtcToLocalPipe
];
