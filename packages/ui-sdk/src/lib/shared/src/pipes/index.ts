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

export { CurrencyPositionPipe } from './currency-position.pipe';
export { DateFormatPipe } from './date-format.pipe';
export { DateTimeFormatPipe } from './datetime-format.pipe';
export { DurationFormatPipe } from './duration-format.pipe';
export { FileSizePipe } from './file-size.pipe';
export { FilterArrayPipe } from './filter-array.pipe';
export { JobBudgetPipe } from './budget.pipe';
export { Nl2BrPipe, TruncatePipe } from './text.pipe';
export { ReplacePipe } from './replace.pipe';
export { SafeHtmlPipe, SafeUrlPipe } from './safe/safe.pipe';
export { TimeFormatPipe } from './time-format.pipe';
export { UtcToLocalPipe } from './utc-to-local.pipe';
export { HashNumberPipe } from './hash-number.pipe';
export { UtcToTimezone } from './utc-to-timezone.pipe';

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
