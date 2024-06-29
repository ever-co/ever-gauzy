import { CapitalizePipe } from './capitalize.pipe';
import { EvaIconsPipe } from './eva-icons.pipe';
import { NumberWithCommasPipe } from './number-with-commas.pipe';
import { PluralPipe } from './plural.pipe';
import { RoundPipe } from './round.pipe';
import { TimingPipe } from './timing.pipe';

export * from './capitalize.pipe';
export * from './plural.pipe';
export * from './round.pipe';
export * from './timing.pipe';
export * from './number-with-commas.pipe';
export * from './eva-icons.pipe';

export const Pipes = [
	PluralPipe,
	RoundPipe,
	TimingPipe,
	NumberWithCommasPipe,
	EvaIconsPipe,
	CapitalizePipe
];
