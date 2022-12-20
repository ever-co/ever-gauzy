import { IntervalTO } from '../offline/dto/interval.dto';
import { ITransaction } from './i-transaction';

export interface IIntervalTransaction extends ITransaction<IntervalTO> {
	synced(offlineStartAt: Date, offlineEndAt: Date): Promise<void>;
}
