import { CandidateBulkCreateHandler } from './candidate.bulk.create.handler';
import { CandidateCreateHandler } from './candidate.create.handler';

export const CommandHandlers = [
	CandidateCreateHandler,
	CandidateBulkCreateHandler
];
