import { Connection } from 'typeorm';
import { ICandidate, IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import * as faker from 'faker';
import { CandidateInterview, CandidateInterviewers } from './../core/entities/internal';

export const createDefaultCandidateInterviewers = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization,
	defaultEmployees,
	defaultCandidates
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
	for (const defaultCandidate of defaultCandidates) {
		const CandidateInterviews = await connection.manager.find(
			CandidateInterview,
			{
				where: [{ candidate: defaultCandidate }]
			}
		);
		candidates = await dataOperation(
			connection,
			tenant,
			organization,
			candidates,
			CandidateInterviews,
			defaultEmployees
		);
	}
	return candidates;
};

export const createRandomCandidateInterviewers = async (
	connection: Connection,
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
			const CandidateInterviews = await connection.manager.find(
				CandidateInterview,
				{
					where: [{ candidate: tenantCandidate }]
				}
			);
			candidates = await dataOperation(
				connection,
				tenant,
				tenantCandidate.organization,
				candidates,
				CandidateInterviews,
				tenantEmployees
			);
		}
	}
	return candidates;
};

const dataOperation = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization,
	candidates,
	CandidateInterviews,
	tenantEmployees: IEmployee[]
) => {
	for (const interview of CandidateInterviews) {
		const candidate = new CandidateInterviewers();

		candidate.interviewId = interview.id;
		candidate.interview = interview;
		candidate.employeeId = faker.random.arrayElement(tenantEmployees).id;

		candidate.tenant = tenant;
		candidate.organization = organization;
		candidates.push(candidate);
	}
	await connection.manager.save(candidates);
	return candidates;
};
