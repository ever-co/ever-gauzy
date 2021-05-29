import { ICandidate, ICandidateDocument, IOrganization, ITenant } from '@gauzy/contracts';
import * as faker from 'faker';
import { Connection } from 'typeorm';
import { CandidateDocument, Organization } from './../core/entities/internal';
import { DEFAULT_CANDIDATE_DOCUMENTS } from './default-candidate-documents';

export const createCandidateDocuments = async (
	connection: Connection,
	tenant: ITenant,
	candidates: ICandidate[] | void,
	organization: IOrganization
): Promise<CandidateDocument[]> => {
	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateDocuments will not be created'
		);
		return;
	}
	let defaultCandidateDocuments = [];
	for (const candidate of candidates) {
		const documents = DEFAULT_CANDIDATE_DOCUMENTS.map((document) => ({
			name: document.name,
			documentUrl: document.documentUrl,
			candidateId: candidate.id,
			tenant: tenant,
			organization: organization
		}));
		defaultCandidateDocuments = [
			...defaultCandidateDocuments,
			...documents
		];
	}
	await insertCandidateDocuments(connection, defaultCandidateDocuments);
	return defaultCandidateDocuments;
};

export const createRandomCandidateDocuments = async (
	connection: Connection,
	tenants: ITenant[],
	tenantCandidatesMap: Map<ITenant, ICandidate[]> | void
): Promise<Map<ICandidate, ICandidateDocument[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateDocuments will not be created'
		);
		return;
	}
	let candidateDocuments = [];
	const candidateDocumentsMap: Map<ICandidate, any[]> = new Map();
	for await (const tenant of tenants || []) {
		const organizations = await connection.manager.find(Organization, {
			where: { 
				tenant: tenant 
			}
		});
		const candidates = tenantCandidatesMap.get(tenant);
		for (const candidate of candidates || []) {
			const documents = DEFAULT_CANDIDATE_DOCUMENTS.map((document) => ({
				name: document.name,
				documentUrl: document.documentUrl,
				candidateId: candidate.id,
				organization: faker.random.arrayElement(organizations),
				tenant: tenant
			}));
			candidateDocumentsMap.set(candidate, documents);
			candidateDocuments = [...candidateDocuments, ...documents];
		}
	}
	await insertCandidateDocuments(connection, candidateDocuments);
	return candidateDocumentsMap;
};

const insertCandidateDocuments = async (
	connection: Connection,
	candidateDocuments: CandidateDocument[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(CandidateDocument)
		.values(candidateDocuments)
		.execute();
};
