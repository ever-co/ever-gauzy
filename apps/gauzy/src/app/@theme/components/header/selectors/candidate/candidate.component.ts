import { Component } from '@angular/core';
import { Tag } from '@gauzy/models';

//TODO: Currently the whole application assumes that if candidate or id is null then you need to get data for All Candidates
//That should not be the case, sometimes due to permissions like CHANGE_SELECTED_CANDIDATE not being available
//we need to handle cases where No Candidate is selected too
export interface SelectedCandidate {
	id: string;
	firstName: string;
	lastName: string;
	imageUrl: string;
	defaultType?: DEFAULT_TYPE;
	tags?: Tag[];
}

export enum DEFAULT_TYPE {
	ALL_CANDIDATE = 'ALL_CANDIDATE',
	NO_CANDIDATE = 'NO_CANDIDATE'
}

export const ALL_CANDIDATES_SELECTED: SelectedCandidate = {
	id: null,
	firstName: 'All Candidates',
	lastName: '',
	imageUrl: 'https://i.imgur.com/XwA2T62.jpg',
	defaultType: DEFAULT_TYPE.ALL_CANDIDATE,
	tags: []
};

export const NO_CANDIDATE_SELECTED: SelectedCandidate = {
	id: null,
	firstName: '',
	lastName: '',
	imageUrl: '',
	defaultType: DEFAULT_TYPE.NO_CANDIDATE,
	tags: []
};

@Component({
	selector: 'ga-candidate-selector',
	templateUrl: ''
})
export class CandidateSelectorComponent {}
