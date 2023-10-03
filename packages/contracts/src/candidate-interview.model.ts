import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRelationalCandidate } from './candidate.model';
import { ICandidateFeedback } from './candidate-feedback.model';
import { ICandidateInterviewers } from './candidate-interviewers.model';
import { ICandidatePersonalQualities } from './candidate-personal-qualities.model';
import { ICandidateTechnologies } from './candidate-technologies.model';
import { IEmployee } from './employee.model';

export interface IRelationalCandidateInterview {
	readonly interview?: ICandidateInterview;
	readonly interviewId?: ICandidateInterview['id'];
}

export interface ICandidateInterview extends IBasePerTenantAndOrganizationEntityModel, IRelationalCandidate {
	title: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	startTime: Date;
	endTime: Date;
	note?: string;
	feedbacks?: ICandidateFeedback[];
	employees?: IEmployee[];
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
	rating?: number;
}

export interface ICandidateInterviewFindInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalCandidate {
	title?: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	startTime?: Date;
	endTime?: Date;
	note?: string;
	feedbacks?: ICandidateFeedback[];
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
}

export interface ICandidateInterviewCreateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalCandidate {
	title: string;
	interviewers?: ICandidateInterviewers[];
	location?: string;
	note?: string;
	startTime: Date;
	endTime: Date;
	feedbacks?: ICandidateFeedback[];
	technologies?: ICandidateTechnologies[];
	personalQualities?: ICandidatePersonalQualities[];
}
