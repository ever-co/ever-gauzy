import { CandidateInterviewMutationComponent } from './candidate-interview-mutation.component';

/**
 * Editing an interview and deselecting an interviewer never removed them: the bulk-delete endpoint expects
 * `{ employeeId }` objects (and is not scoped to the interview), while plain employee ids were sent, so the
 * server found nothing to delete and the newly selected interviewers piled up on the old ones.
 */
describe('CandidateInterviewMutationComponent.editInterview', () => {
	it('deletes the deselected interviewers by their own rows and adds the new ones', async () => {
		const candidateInterviewersService = {
			delete: jest.fn().mockResolvedValue({}),
			deleteBulkByEmployeeId: jest.fn()
		};
		const updated = { id: 'interview-1' };
		const component = {
			interviewId: 'interview-1',
			editData: {
				id: 'interview-1',
				interviewers: [
					{ id: 'row-a', employeeId: 'employee-a' },
					{ id: 'row-b', employeeId: 'employee-b' }
				],
				personalQualities: [],
				technologies: []
			},
			// Employee B was deselected, employee C selected
			interview: { title: 'Tech screen', interviewers: ['employee-a', 'employee-c'] },
			updateCriterions: jest.fn(),
			addInterviewers: jest.fn(),
			candidateInterviewService: { update: jest.fn().mockResolvedValue(updated) },
			candidateInterviewersService,
			errorHandler: { handleError: jest.fn() }
		};

		const result = await CandidateInterviewMutationComponent.prototype.editInterview.call(component);

		expect(result).toBe(updated);
		expect(candidateInterviewersService.delete).toHaveBeenCalledTimes(1);
		expect(candidateInterviewersService.delete).toHaveBeenCalledWith('row-b');
		expect(candidateInterviewersService.deleteBulkByEmployeeId).not.toHaveBeenCalled();
		expect(component.addInterviewers).toHaveBeenCalledWith('interview-1', ['employee-c']);
	});
});
