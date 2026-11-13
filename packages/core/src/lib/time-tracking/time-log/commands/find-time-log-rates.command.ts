import { ICommand } from '@nestjs/cqrs';
import type { TimeLogRatesScope } from '../time-log-rates';

/**
 * What a time log is to store of the rates of the moment: all of them for a log being recorded or moved to another
 * member, the client rates only for a log moved to another project.
 */
export type TimeLogRatesPart = 'all' | 'client';

/** Reads the rates of the moment a time log is recorded with (see time-log-rates.ts). */
export class FindTimeLogRatesCommand implements ICommand {
	static readonly type = '[Time Tracking] Time Log find rates';

	constructor(
		public readonly scope: TimeLogRatesScope,
		public readonly part: TimeLogRatesPart = 'all'
	) {}
}
