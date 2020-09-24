import { ICandidatePersonalQualities } from './candidate-personal-qualities.model';
import { IEmployee } from './employee.model';
import {
	ICandidateFeedback,
	ICandidateInterviewers,
	ICandidateTechnologies,
	ICandidate
} from '@gauzy/models';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateInterview
	extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	candidateId?: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	startTime: Date;
	endTime: Date;
	note?: string;
	feedbacks?: ICandidateFeedback[];
	employees?: IEmployee[];
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
	candidate: ICandidate;
	rating?: number;
	isArchived?: boolean;
}

export interface ICandidateInterviewFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	title?: string;
	candidateId?: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	startTime?: Date;
	endTime?: Date;
	note?: string;
	feedbacks?: ICandidateFeedback[];
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
}

export interface ICandidateInterviewCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	candidateId?: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	note?: string;
	startTime: Date;
	endTime: Date;
	feedbacks?: ICandidateFeedback[];
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
}
