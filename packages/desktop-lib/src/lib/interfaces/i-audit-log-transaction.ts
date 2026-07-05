import { AuditLogTO } from "../offline";
import { ITransaction } from "./i-transaction";
export interface ITransactionAuditLog extends ITransaction<AuditLogTO> {};
