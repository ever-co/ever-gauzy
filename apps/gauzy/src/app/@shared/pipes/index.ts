import { TimeFormatPipe } from './time-format.pipe';
import { DurationFormatPipe } from './duration-format.pipe';
import { UtcToLocalPipe } from './utc-to-local.pipe';
import { ReplacePipe } from './replace.pipe';

export const Pipes = [
	TimeFormatPipe,
	DurationFormatPipe,
	UtcToLocalPipe,
	ReplacePipe
];
