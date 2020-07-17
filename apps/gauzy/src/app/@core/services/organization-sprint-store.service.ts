import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
	OrganizationSprint,
	Organization,
	ITenant,
	GetSprintsOptions,
	Task
} from '@gauzy/models';
import { SprintService } from 'apps/gauzy/src/app/@core/services/organization-sprint.service';
import { tap, take, map, switchMap } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class SprintStoreService {
	private _sprints$: BehaviorSubject<
		OrganizationSprint[]
	> = new BehaviorSubject([]);
	sprints$: Observable<OrganizationSprint[]> = this._sprints$.asObservable();

	private get sprints(): OrganizationSprint[] {
		return this._sprints$.getValue();
	}

	constructor(private sprintService: SprintService) {
		if (!this.sprints.length) {
			this.fetchSprints();
		}
	}

	fetchSprints(findInput: GetSprintsOptions = {}) {
		this.sprintService
			.getAllSprints(findInput)
			.pipe(tap(({ items }) => this.loadAllSprints(items)))
			.subscribe();
	}

	loadAllSprints(sprints: OrganizationSprint[]): void {
		this._sprints$.next(sprints);
	}

	createSprint(
		newSprint: OrganizationSprint
	): Observable<OrganizationSprint> {
		return this.sprintService.createSprint(newSprint).pipe(
			tap((createdSprint: OrganizationSprint) => {
				const sprints = [...this.sprints, createdSprint];
				this._sprints$.next(sprints as OrganizationSprint[]);
			}),
			take(1)
		);
	}

	updateSprint(
		editedSprint: OrganizationSprint
	): Observable<OrganizationSprint> {
		return this.sprintService
			.editSprint(editedSprint.id, editedSprint)
			.pipe(
				tap(() => {
					const sprints = [...this.sprints];
					const newState = sprints.map((t) =>
						t.id === editedSprint.id ? editedSprint : t
					);
					this._sprints$.next(newState);
				}),
				take(1)
			);
	}

	deleteSprint(id: string): Observable<void> {
		return this.sprintService.deleteSprint(id).pipe(
			tap(() => {
				const newState = this.sprints.filter(
					(sprint: OrganizationSprint) => sprint.id !== id
				);
				this._sprints$.next(newState);
			}),
			take(1)
		);
	}

	moveTaskToSprint(
		sprintId: string,
		task: Task
	): Observable<OrganizationSprint> {
		return this.sprints$.pipe(
			map((sprints: OrganizationSprint[]) =>
				sprints.find(
					(sprint: OrganizationSprint) => sprint.id === sprintId
				)
			),
			switchMap(({ tasks }: OrganizationSprint) =>
				this.sprintService.editSprint(sprintId, {
					tasks: [...tasks, task]
				})
			),
			tap((updatedSprint: OrganizationSprint) => {
				// const sprints = [...this.sprints];
				// const newState = sprints.map((sprint: OrganizationSprint): OrganizationSprint =>
				//   sprint.id === updatedSprint.id ? updatedSprint : sprint
				// );
				// this._sprints$.next(newState);
			}),
			take(1)
		);
	}
}
