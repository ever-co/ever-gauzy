import { SyncLogTO } from "../offline/dto";

/**
	* Interface for the Sync Data Log Service
	* This service is responsible for managing synchronization log data, including saving, retrieving, and updating sync log entries.
	* @template T The type of synchronization log data being managed
*/
export interface ISyncDataLogService<T> {
	saveAndReturn(log: T): Promise<SyncLogTO>;
	update(log: Partial<T>): Promise<void>;
	findById(id: number): Promise<SyncLogTO | null>;
}
