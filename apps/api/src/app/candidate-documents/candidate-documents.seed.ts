import { ICandidateDocument, Candidate } from '@gauzy/models';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { CandidateDocument } from './candidate-documents.entity';

const candidateDocumentList: ICandidateDocument[] = [
	{
		name: 'Document 1',
		documentUrl:
			'http://res.cloudinary.com/evereq/image/upload/v1587742725/everbie-products-images/n07vjqa8pa8dfinkzqdy.pdf'
	},
	{
		name: 'Document 2',
		documentUrl:
			'http://res.cloudinary.com/evereq/raw/upload/v1587742757/everbie-products-images/wxjghcvuysc3imrx7z2t.docx'
	}
];
export const createCandidateDocuments = async (
	connection: Connection,
	candidates: Candidate[] | void
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
			candidateId: candidate.id
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
	tenantCandidatesMap: Map<Tenant, Candidate[]> | void
): Promise<Map<Candidate, CandidateDocument[]>> => {
	if (!tenantCandidatesMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, CandidateDocuments will not be created'
		);
		return;
	}

	let candidateDocuments = [];
	const candidateDocumentsMap: Map<Candidate, any[]> = new Map();

	(tenants || []).forEach((tenant) => {
		const candidates = tenantCandidatesMap.get(tenant);

		(candidates || []).forEach((candidate) => {
			const documents = candidateDocumentList.map((document) => ({
				name: document.name,
				documentUrl: document.documentUrl,
				candidateId: candidate.id
			}));

			candidateDocumentsMap.set(candidate, documents);
			candidateDocuments = [...candidateDocuments, ...documents];
		});
	});

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
