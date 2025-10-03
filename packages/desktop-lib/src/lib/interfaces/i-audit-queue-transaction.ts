import { AuditQueueTO } from '../offline/dto/queue-audit.dto';
import { ITransaction } from './i-transaction';

export interface IAuditQueueTransaction extends ITransaction<AuditQueueTO> {}
