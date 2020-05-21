import { CandidateInterviewersInterviewBulkDeleteHandler } from './candidate-interviewers.interview.bulk.delete.handler';
import { CandidateInterviewersEmployeeBulkDeleteHandler } from './candidate-interviewers.employee.bulk.delete.handler';

export const CommandHandlers = [
	CandidateInterviewersEmployeeBulkDeleteHandler,
	CandidateInterviewersInterviewBulkDeleteHandler
];
