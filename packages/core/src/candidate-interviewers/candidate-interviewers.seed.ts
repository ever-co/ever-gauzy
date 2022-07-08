import { DataSource } from 'typeorm';
import { ICandidate, ICandidateInterview, ICandidateInterviewers, IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@ever-co/faker';
import { CandidateInterview, CandidateInterviewers } from './../core/entities/internal';

export const createDefaultCandidateInterviewers = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	defaultEmployees: IEmployee[],
	defaultCandidates: ICandidate[]
): Promise<CandidateInterviewers[]> => {
	if (!defaultEmployees) {
		console.warn(
			'Warning: defaultEmployees not found, Default CandidateInterviewers will not be created'
		);
		return;
	}
	if (!defaultCandidates) {
		console.warn(
			'Warning: defaultCandidates not found, Default Candidate Interviewers will not be created'
		);
		return;
	}

	let candidates: CandidateInterviewers[] = [];
	for (const candidate of defaultCandidates) {
		const { id: candidateId } = candidate;
		const candidateInterviews = await dataSource.manager.find(CandidateInterview, {
			where: {
				candidateId: candidateId
			}
		});
		candidates = await dataOperation(
			dataSource,
			tenant,
			organization,
			candidates,
			candidateInterviews,
			defaultEmployees
		);
	}
	return candidates;
};

export const createRandomCandidateInterviewers = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	tenantCandidatesMap: Map<ITenant, ICandidate[]> | void
): Promise<CandidateInterviewers[]> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateInterviewers will not be created'
		);
		return;
	}

	let candidates: CandidateInterviewers[] = [];
	for (const tenant of tenants) {
		const tenantCandidates = tenantCandidatesMap.get(tenant);
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		for (const tenantCandidate of tenantCandidates) {
			const { id: candidateId } = tenantCandidate;
			const candidateInterviews = await dataSource.manager.find(CandidateInterview, {
				where: {
					candidateId: candidateId
				}
			});
			candidates = await dataOperation(
				dataSource,
				tenant,
				tenantCandidate.organization,
				candidates,
				candidateInterviews,
				tenantEmployees
			);
		}
	}
	return candidates;
};

const dataOperation = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	candidates: ICandidateInterviewers[],
	candidateInterviews: ICandidateInterview[],
	tenantEmployees: IEmployee[]
) => {
	for (const interview of candidateInterviews) {
		const candidate = new CandidateInterviewers();

		candidate.interviewId = interview.id;
		candidate.employeeId = faker.random.arrayElement(tenantEmployees).id;

		candidate.tenant = tenant;
		candidate.organization = organization;
		candidates.push(candidate);
	}
	await dataSource.manager.save(candidates);
	return candidates;
};
