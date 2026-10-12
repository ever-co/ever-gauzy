import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { IEmployee } from '@gauzy/contracts';
import { EmployeesService, Store } from '@gauzy/ui-core/core';
import { filterMentionCandidates, IMentionCandidate, MENTION_TRIGGER } from './document-comments.model';

/**
 * Org-scoped employee directory behind the comment composer's `@` menu.
 *
 * Provided once on the thread (not per composer) so the root composer, every
 * reply box and every inline editor share a single `shareReplay(1)` fetch —
 * the editor's mention suggestion caches for exactly the same reason
 * (`employee-mention.suggestion.ts`), and a panel with three open composers
 * should still cost one request.
 *
 * The list loads lazily on the first `@`, and a failure resolves to an empty
 * menu rather than an error: mentioning is an assist, not the point of the box.
 */
@Injectable()
export class MentionDirectoryService {
	private employees$?: Observable<IEmployee[]>;

	constructor(private readonly employeesService: EmployeesService, private readonly store: Store) {}

	/** Candidates whose label matches `query`, capped for the popup. */
	search(query: string): Observable<IMentionCandidate[]> {
		return this.employees().pipe(map((employees) => filterMentionCandidates(employees, query)));
	}

	/**
	 * Everyone whose `@Name` already appears in a saved comment body.
	 *
	 * 🛑 An edit re-sends `mentionEmployeeIds` and the backend *replaces* the
	 * mention rows with exactly that array (`MentionService.updateEntityMentions`),
	 * so an editor seeded with an empty list would silently un-mention everyone
	 * the comment names. Re-deriving from the text is what keeps an edit additive.
	 */
	matchInText(text: string): Observable<IMentionCandidate[]> {
		return this.employees().pipe(
			map((employees) =>
				filterMentionCandidates(employees, '', Number.MAX_SAFE_INTEGER).filter((candidate) =>
					text.includes(`${MENTION_TRIGGER}${candidate.label}`)
				)
			)
		);
	}

	private employees(): Observable<IEmployee[]> {
		if (!this.employees$) {
			const organization = this.store.selectedOrganization;
			this.employees$ = (
				organization
					? this.employeesService.getAll(['user'], {
							organizationId: organization.id,
							tenantId: organization.tenantId
					  })
					: of({ items: [] as IEmployee[], total: 0 })
			).pipe(
				map((page) => page?.items ?? []),
				catchError(() => of([] as IEmployee[])),
				shareReplay({ bufferSize: 1, refCount: false })
			);
		}
		return this.employees$;
	}
}
