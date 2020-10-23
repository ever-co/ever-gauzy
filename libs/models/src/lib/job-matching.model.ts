import { IEmployee } from './employee.model';

export interface JobMatchings {
	employeeId?: string;
	jobSource?: string;
	preset?: string;
	criterias?: MatchingCriterias[];
}

export interface UpworkJobMatchingCriterias {
	keywords?: string[];
	categories?: string[];
	occupations?: string[];
	hourly?: boolean;
	fixPrice?: boolean;
}

export interface MatchingCriterias extends UpworkJobMatchingCriterias {}
