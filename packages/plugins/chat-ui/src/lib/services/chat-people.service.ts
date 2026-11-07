import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { ID, IEmployee, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { ChatPerson, userName } from '../chat-ui.helpers';

/** The people of the organization, by employee id and by user id, plus the list for the pickers. */
export interface ChatPeople {
	byEmployee: ReadonlyMap<string, ChatPerson>;
	byUser: ReadonlyMap<string, ChatPerson>;
	list: readonly ChatPerson[];
}

export const EMPTY_PEOPLE: ChatPeople = { byEmployee: new Map(), byUser: new Map(), list: [] };

/**
 * The organization's active employees, for the names and pictures the chat shows (authors, members, mention chips)
 * and the `@` suggestions and the new-message picker. Read once per organization through Gauzy's own `/api/employee`
 * route and shared by every component; `refresh()` reads again.
 */
@Injectable({ providedIn: 'root' })
export class ChatPeopleService {
	private readonly http = inject(HttpClient);
	private readonly cache = new Map<string, Observable<ChatPeople>>();

	people(organizationId: ID, tenantId: ID): Observable<ChatPeople> {
		const key = `${tenantId}:${organizationId}`;
		let cached = this.cache.get(key);
		if (!cached) {
			cached = this.http
				.get<IPagination<IEmployee>>(`${API_PREFIX}/employee`, {
					params: toParams({ relations: ['user'], where: { organizationId, tenantId } })
				})
				.pipe(
					map((page) => toPeople(page?.items ?? [])),
					catchError(() => of(EMPTY_PEOPLE)),
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

/** The employees as people, active ones only, named and sorted. */
export function toPeople(employees: readonly IEmployee[]): ChatPeople {
	const byEmployee = new Map<string, ChatPerson>();
	const byUser = new Map<string, ChatPerson>();
	for (const employee of employees) {
		if (!employee?.id || employee.isActive === false || employee.isArchived) continue;
		const name = userName(employee.user) || employee.fullName || String(employee.id);
		const person: ChatPerson = {
			employeeId: String(employee.id),
			userId: employee.userId ? String(employee.userId) : employee.user?.id ? String(employee.user.id) : null,
			name,
			imageUrl: employee.user?.imageUrl ?? null
		};
		byEmployee.set(person.employeeId, person);
		if (person.userId) byUser.set(person.userId, person);
	}
	const list = [...byEmployee.values()].sort((a, b) => a.name.localeCompare(b.name));
	return { byEmployee, byUser, list };
}
