import { CandidateInterviewMutationComponent } from './candidate-interview-mutation.component';

/**
 * Editing an interview and deselecting an interviewer never removed them: the bulk-delete endpoint expects
 * `{ employeeId }` objects (and is not scoped to the interview), while plain employee ids were sent, so the
 * server found nothing to delete and the newly selected interviewers piled up on the old ones.
 */
describe('CandidateInterviewMutationComponent.editInterview', () => {
	const updated = { id: 'interview-1' };
	const storedInterviewers = [
		{ id: 'row-a', employeeId: 'employee-a' },
		{ id: 'row-b', employeeId: 'employee-b' }
	];

	const setup = (selectedEmployeeIds: string[] | null) => {
		const candidateInterviewersService = {
			delete: jest.fn().mockResolvedValue({}),
			deleteBulkByEmployeeId: jest.fn()
		};
		const component = {
			interviewId: 'interview-1',
			editData: { id: 'interview-1', interviewers: storedInterviewers, personalQualities: [], technologies: [] },
			interview: { title: 'Tech screen', interviewers: selectedEmployeeIds },
			updateCriterions: jest.fn(),
			addInterviewers: jest.fn(),
			candidateInterviewService: { update: jest.fn().mockResolvedValue(updated) },
			candidateInterviewersService,
			errorHandler: { handleError: jest.fn() }
		};
		const edit = () => CandidateInterviewMutationComponent.prototype.editInterview.call(component);
		return { component, edit, candidateInterviewersService };
	};

	it('deletes the deselected interviewers by their own rows, keeps the others and adds the new ones', async () => {
		// Employee B was deselected, employee C selected
		const { component, edit, candidateInterviewersService } = setup(['employee-a', 'employee-c']);

		await expect(edit()).resolves.toBe(updated);

		expect(candidateInterviewersService.delete.mock.calls).toEqual([['row-b']]);
		expect(candidateInterviewersService.deleteBulkByEmployeeId).not.toHaveBeenCalled();
		expect(component.addInterviewers).toHaveBeenCalledWith('interview-1', ['employee-c']);
	});

	it('deletes nobody when the interviewers were not touched (null selection)', async () => {
		const { component, edit, candidateInterviewersService } = setup(null);

		await edit();

		expect(candidateInterviewersService.delete).not.toHaveBeenCalled();
		expect(component.addInterviewers).toHaveBeenCalledWith('interview-1', []);
	});

	it('deletes every interviewer when all of them were deselected', async () => {
		const { edit, candidateInterviewersService } = setup([]);

		await edit();

		expect(candidateInterviewersService.delete.mock.calls.sort()).toEqual([['row-a'], ['row-b']]);
	});

	it('leaves the interviewers alone when the interview itself could not be saved', async () => {
		const { component, edit, candidateInterviewersService } = setup(['employee-a']);
		const failure = new Error('save failed');
		component.candidateInterviewService.update.mockRejectedValue(failure);

		await expect(edit()).resolves.toBeUndefined();

		expect(component.errorHandler.handleError).toHaveBeenCalledWith(failure);
		expect(candidateInterviewersService.delete).not.toHaveBeenCalled();
		expect(component.addInterviewers).not.toHaveBeenCalled();
	});

	it('reports a failed deletion and still performs the other deletions and the additions', async () => {
		const { component, edit, candidateInterviewersService } = setup(['employee-c']);
		const failure = new Error('delete failed');
		candidateInterviewersService.delete.mockImplementation((id: string) =>
			id === 'row-a' ? Promise.reject(failure) : Promise.resolve({})
		);

		await expect(edit()).resolves.toBe(updated);

		expect(candidateInterviewersService.delete.mock.calls.sort()).toEqual([['row-a'], ['row-b']]);
		expect(component.errorHandler.handleError).toHaveBeenCalledWith(failure);
		expect(component.addInterviewers).toHaveBeenCalledWith('interview-1', ['employee-c']);
	});
});
