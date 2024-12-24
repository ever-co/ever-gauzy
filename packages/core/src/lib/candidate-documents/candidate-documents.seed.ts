import { ICandidate, ICandidateDocument, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { CandidateDocument, Organization } from './../core/entities/internal';
import { DEFAULT_CANDIDATE_DOCUMENTS } from './default-candidate-documents';

export const createCandidateDocuments = async (
	dataSource: DataSource,
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
		const { id: organizationId } = organization;
		const { id: tenantId } = tenant;
		const { id: candidateId } = candidate;

		const documents = DEFAULT_CANDIDATE_DOCUMENTS.map((document) => ({
			name: document.name,
			documentUrl: document.documentUrl,
			candidateId: candidateId,
			tenantId: tenantId,
			organizationId: organizationId
		}));
		defaultCandidateDocuments = [
			...defaultCandidateDocuments,
			...documents
		];
	}
	await insertCandidateDocuments(dataSource, defaultCandidateDocuments);
	return defaultCandidateDocuments;
};

export const createRandomCandidateDocuments = async (
	dataSource: DataSource,
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
		const { id: tenantId } = tenant;
		const organizations = await dataSource.manager.findBy(Organization, {
			tenantId: tenantId
		});
		const candidates = tenantCandidatesMap.get(tenant);
		for (const candidate of candidates || []) {
			const { id: candidateId } = candidate;
			const documents = DEFAULT_CANDIDATE_DOCUMENTS.map((document) => ({
				name: document.name,
				documentUrl: document.documentUrl,
				candidateId: candidateId,
				organization: faker.helpers.arrayElement(organizations),
				tenantId: tenantId
			}));
			candidateDocumentsMap.set(candidate, documents);
			candidateDocuments = [...candidateDocuments, ...documents];
		}
	}
	await insertCandidateDocuments(dataSource, candidateDocuments);
	return candidateDocumentsMap;
};

const insertCandidateDocuments = async (
	dataSource: DataSource,
	candidateDocuments: CandidateDocument[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(CandidateDocument)
		.values(candidateDocuments)
		.execute();
};
