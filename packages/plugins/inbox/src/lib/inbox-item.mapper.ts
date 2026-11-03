import { IInboxItem, IInboxItemOption, IInboxItemResponse } from '@gauzy/contracts';
import { InboxItem } from './entities/inbox-item.entity';

/** Parses a JSON column; a malformed document reads as `null` rather than failing the whole page. */
export function parseJson<T>(value: string | null | undefined): T | null {
	if (value === null || value === undefined || value === '') return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

/** The item as the API answers it (JSON columns parsed). */
export function toInboxItem(row: InboxItem): IInboxItem {
	return {
		...(row as unknown as IInboxItem),
		options: parseJson<IInboxItemOption[]>(row.options),
		response: parseJson<IInboxItemResponse>(row.response),
		metadata: parseJson<Record<string, unknown>>(row.metadata),
		requireReason: !!row.requireReason
	};
}
