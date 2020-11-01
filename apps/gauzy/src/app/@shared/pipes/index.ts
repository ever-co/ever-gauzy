import { TimeFormatPipe } from './time-format.pipe';
import { DurationFormatPipe } from './duration-format.pipe';
import { UtcToLocalPipe } from './utc-to-local.pipe';
import { ReplacePipe } from './replace.pipe';
import { Nl2BrPipe, SafeHtmlPipe } from './text.pipe';

export const Pipes = [
	TimeFormatPipe,
	DurationFormatPipe,
	UtcToLocalPipe,
	ReplacePipe,
	SafeHtmlPipe,
	Nl2BrPipe
];
