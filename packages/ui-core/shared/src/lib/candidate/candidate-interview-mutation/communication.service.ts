import { Injectable } from '@angular/core';
import { ICandidatePersonalQualities, ICandidateTechnologies } from '@gauzy/contracts';
import { Subject } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class CommunicationService {
	// Subjects for technologies
	private technologyAddedSource = new Subject<ICandidateTechnologies>();
	private technologyRemovedSource = new Subject<string>();

	// Subjects for qualities
	private qualityAddedSource = new Subject<ICandidatePersonalQualities>();
	private qualityRemovedSource = new Subject<string>();

	// Observables for technologies
	technologyAdded$ = this.technologyAddedSource.asObservable();
	technologyRemoved$ = this.technologyRemovedSource.asObservable();

	// Observables for qualities
	qualityAdded$ = this.qualityAddedSource.asObservable();
	qualityRemoved$ = this.qualityRemovedSource.asObservable();

	// Methods for technologies
	addTechnology(technology: ICandidateTechnologies): void {
		this.technologyAddedSource.next(technology);
	}

	removeTechnology(technologyId: string): void {
		this.technologyRemovedSource.next(technologyId);
	}

	// Methods for qualities
	addQuality(quality: ICandidatePersonalQualities): void {
		this.qualityAddedSource.next(quality);
	}

	removeQuality(qualityId: string): void {
		this.qualityRemovedSource.next(qualityId);
	}
}
