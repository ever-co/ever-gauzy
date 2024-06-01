import { CurrencyPositionPipe } from './currency-position.pipe';
import { DateFormatPipe } from './date-format.pipe';
import { DateTimeFormatPipe } from './datetime-format.pipe';
import { DurationFormatPipe } from './duration-format.pipe';
import { FileSizePipe } from './file-size.pipe';
import { FilterArrayPipe } from './filter-array.pipe';
import { JobBudgetPipe } from './budget.pipe';
import { Nl2BrPipe, TruncatePipe } from './text.pipe';
import { ReplacePipe } from './replace.pipe';
import { SafeHtmlPipe, SafeUrlPipe } from './safe/safe.pipe';
import { TimeFormatPipe } from './time-format.pipe';
import { UtcToLocalPipe } from './utc-to-local.pipe';
import { HashNumberPipe } from './hash-number.pipe';
import { UtcToTimezone } from './utc-to-timezone.pipe';

export * from './budget.pipe';
export * from './currency-position.pipe';
export * from './date-format.pipe';
export * from './datetime-format.pipe';
export * from './duration-format.pipe';
export * from './file-size.pipe';
export * from './filter-array.pipe';
export * from './replace.pipe';
export * from './safe/safe.pipe';
export * from './text.pipe';
export * from './time-format.pipe';
export * from './utc-to-local.pipe';
export * from './utc-to-timezone.pipe';
export * from './hash-number.pipe';

export const Pipes = [
	CurrencyPositionPipe,
	DateFormatPipe,
	DateTimeFormatPipe,
	DurationFormatPipe,
	FileSizePipe,
	FilterArrayPipe,
	JobBudgetPipe,
	Nl2BrPipe,
	ReplacePipe,
	SafeHtmlPipe,
	SafeUrlPipe,
	TimeFormatPipe,
	TruncatePipe,
	UtcToLocalPipe,
	UtcToTimezone,
	HashNumberPipe
];
