import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { OrganizationSprint, Organization, ITenant } from '@gauzy/models';

export class MockSprint implements OrganizationSprint {
	id: string;
	name: string;
	goal: string;
	organization: Organization;
	organizationId: string;
	tenant: ITenant;
	length: number;

	private rand(value: number = 20): string {
		return `${Math.floor(Math.random() * value) + 1}`;
	}
	constructor(name?, goal?, length?, organization?, tenant?) {
		this.id = this.rand();
		(this.name = name || `Sprint ${this.rand()}`),
			(this.goal = goal || this.rand());
		this.length = length || 14;
		this.organization = organization || ({} as Organization);
		this.organizationId = organization.id || ({} as Organization);
		this.tenant = tenant || { name: 'TenantName' };
	}
}

@Injectable({
	providedIn: 'root'
})
export class SprintStoreService {
	private _sprints$: BehaviorSubject<
		OrganizationSprint[]
	> = new BehaviorSubject([]);
	sprints$: Observable<OrganizationSprint[]> = this._sprints$.asObservable();

	private _selectedSprint$: BehaviorSubject<
		OrganizationSprint
	> = new BehaviorSubject(null);
	public selectedSprint$: Observable<
		OrganizationSprint
	> = this._selectedSprint$.asObservable();

	get sprints(): OrganizationSprint[] {
		return this._sprints$.getValue();
	}

	get selectedSprint(): OrganizationSprint {
		return this._selectedSprint$.getValue();
	}

	constructor() {
		if (!this.sprints.length) {
			this.fetchSprints();
		}
		console.log(this.sprints);
	}

	isSprintSelected(): boolean {
		return !!this._selectedSprint$.getValue();
	}

	fetchSprints() {
		this._sprints$.next([
			new MockSprint(),
			new MockSprint(),
			new MockSprint()
		]);
	}

	createSprint(createdSprint: OrganizationSprint): void {
		const sprints = [...this.sprints, createdSprint];
		this._sprints$.next(sprints);
	}

	updateSprint(editedSprint: OrganizationSprint): void {
		const sprints = [...this.sprints];
		const newState = sprints.map((t) =>
			t.id === editedSprint.id ? editedSprint : t
		);
		this._sprints$.next(newState);
		this.clearSelectedSprint();
	}

	deleteSprint(): void {
		if (!this.isSprintSelected()) return;
		const sprints = [...this.sprints];
		const newState = sprints.filter((t) => t.id !== this.selectedSprint.id);
		this._sprints$.next(newState);
		this.clearSelectedSprint();
	}

	clearSelectedSprint(): void {
		this._selectedSprint$.next(null);
	}

	selectSprint(selectedSprint: OrganizationSprint) {
		this._selectedSprint$.next(selectedSprint);
	}
}
