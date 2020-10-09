import { ICandidateDocument, ICandidate } from '@gauzy/models';
import * as faker from 'faker';
import { Connection } from 'typeorm';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { CandidateDocument } from './candidate-documents.entity';

const candidateDocumentList: ICandidateDocument[] = [
	{
		name: 'Document 1',
		documentUrl:
			'http://res.cloudinary.com/evereq/image/upload/v1587742725/everbie-products-images/n07vjqa8pa8dfinkzqdy.pdf',
		tenant: {}
	},
	{
		name: 'Document 2',
		documentUrl:
			'http://res.cloudinary.com/evereq/raw/upload/v1587742757/everbie-products-images/wxjghcvuysc3imrx7z2t.docx',
		tenant: {}
	}
];
export const createCandidateDocuments = async (
	connection: Connection,
	tenant: Tenant,
	candidates: ICandidate[] | void,
	organization: Organization
): Promise<CandidateDocument[]> => {
	let defaultCandidateDocuments = [];

	if (!candidates) {
		console.warn(
			'Warning: candidates not found, CandidateDocuments will not be created'
		);
		return;
	}
	candidates.forEach((candidate) => {
		const documents = candidateDocumentList.map((document) => ({
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
	});

	insertCandidateDocuments(connection, defaultCandidateDocuments);
	return defaultCandidateDocuments;
};

export const createRandomCandidateDocuments = async (
	connection: Connection,
	tenants: Tenant[],
	tenantCandidatesMap: Map<Tenant, ICandidate[]> | void
): Promise<Map<ICandidate, CandidateDocument[]>> => {
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
			where: [{ tenant: tenant }]
		});
		const candidates = tenantCandidatesMap.get(tenant);
		(candidates || []).forEach((candidate) => {
			const documents = candidateDocumentList.map((document) => ({
				name: document.name,
				documentUrl: document.documentUrl,
				candidateId: candidate.id,
				organization: faker.random.arrayElement(organizations),
				tenant: tenant
			}));

			candidateDocumentsMap.set(candidate, documents);
			candidateDocuments = [...candidateDocuments, ...documents];
		});
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
