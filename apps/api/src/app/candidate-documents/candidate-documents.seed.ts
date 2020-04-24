// import { CandidateDocument } from './candidate-documents.entity';
// import { ICandidateDocument } from '@gauzy/models';
// import { Connection } from 'typeorm';

// export const createCandidateDocuments = async (
// 	connection: Connection
// ): Promise<ICandidateDocument[]> => {
// 	const candidateDocument: ICandidateDocument[] = [
// 		{
// 			name: 'Test 1',
// 			documentUrl:
// 				'http://res.cloudinary.com/evereq/image/upload/v1587742725/everbie-products-images/n07vjqa8pa8dfinkzqdy.pdf'
// 		},
// 		{
// 			name: 'Test 2',
// 			documentUrl:
// 				'http://res.cloudinary.com/evereq/raw/upload/v1587742757/everbie-products-images/wxjghcvuysc3imrx7z2t.docx'
// 		}
// 	];

// 	for (let i = 0; i < candidateDocument.length; i++) {
// 		await insertCandidateDocuments(connection, candidateDocument[i]);
// 	}

// 	return candidateDocument;
// };

// const insertCandidateDocuments = async (
// 	connection: Connection,
// 	candidateDocument: CandidateDocument
// ): Promise<void> => {
// 	await connection
// 		.createQueryBuilder()
// 		.insert()
// 		.into(CandidateDocument)
// 		.values(candidateDocument)
// 		.execute();
// };
