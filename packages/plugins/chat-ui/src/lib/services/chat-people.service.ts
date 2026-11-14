import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { ID } from '@gauzy/contracts';
import { ChatPerson } from '../chat-ui.helpers';
import { ChatPersonRecord, ChatUiService } from './chat-ui.service';
import { ChatPresenceService } from './chat-presence.service';

/** The people of the organization, by employee id and by user id, plus the list for the pickers. */
export interface ChatPeople {
	byEmployee: ReadonlyMap<string, ChatPerson>;
	byUser: ReadonlyMap<string, ChatPerson>;
	list: readonly ChatPerson[];
}

export const EMPTY_PEOPLE: ChatPeople = { byEmployee: new Map(), byUser: new Map(), list: [] };

/**
 * The organization's active employees, for the names and pictures the chat shows (authors, members, mention chips)
 * and the `@` suggestions and the new-message picker. Read through the chat's own `GET /chat/people` (open to every
 * chat user, unlike the platform's employee routes), once per organization and shared by every component;
 * `refresh()` reads again.
 */
@Injectable({ providedIn: 'root' })
export class ChatPeopleService {
	private readonly api = inject(ChatUiService);
	private readonly presence = inject(ChatPresenceService);
	private readonly cache = new Map<string, Observable<ChatPeople>>();

	people(organizationId: ID, tenantId: ID): Observable<ChatPeople> {
		const key = `${tenantId}:${organizationId}`;
		let cached = this.cache.get(key);
		if (!cached) {
			const askedAt = Date.now();
			cached = this.api.people().pipe(
				// The list says who is here too: the avatars show it before the first presence event.
				tap((records) => this.presence.applyList(records, askedAt)),
				map((records) => toPeople(records)),
				catchError(() => {
					// A refusal is not kept: the next reader asks again (the chat may be served a moment later).
					this.cache.delete(key);
					return of(EMPTY_PEOPLE);
				}),
				shareReplay({ bufferSize: 1, refCount: false })
			);
			this.cache.set(key, cached);
		}
		return cached;
	}

	refresh(organizationId: ID, tenantId: ID): void {
		this.cache.delete(`${tenantId}:${organizationId}`);
	}
}

/** The records as people, named and sorted, each employee once. */
export function toPeople(records: readonly ChatPersonRecord[]): ChatPeople {
	const byEmployee = new Map<string, ChatPerson>();
	const byUser = new Map<string, ChatPerson>();
	for (const record of records ?? []) {
		if (!record?.employeeId) continue;
		const person: ChatPerson = {
			employeeId: String(record.employeeId),
			userId: record.userId ? String(record.userId) : null,
			name: record.name || String(record.employeeId),
			imageUrl: record.imageUrl ?? null,
			position: record.position?.trim() || undefined
		};
		byEmployee.set(person.employeeId, person);
		if (person.userId) byUser.set(person.userId, person);
	}
	const list = [...byEmployee.values()].sort((a, b) => a.name.localeCompare(b.name));
	return { byEmployee, byUser, list };
}
