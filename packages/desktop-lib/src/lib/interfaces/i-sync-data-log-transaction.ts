import { SyncLogTO } from "../offline/dto";
import { ITransaction } from "./i-transaction";

export interface ISyncDataLogTransaction extends ITransaction<SyncLogTO> {};
