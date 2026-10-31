import { hasSelection, keptSelection, mergeSelections, sameSelection } from './selection-state';

describe('selection state helpers', () => {
	const empty = { clientId: '', projectId: '', teamId: '', taskId: '', note: '' };

	describe('hasSelection', () => {
		it('is true when a client, project, team or task is picked, the note aside', () => {
			expect(hasSelection({ projectId: 'p' })).toBe(true);
			expect(hasSelection({ note: 'only a note' })).toBe(false);
			expect(hasSelection(empty)).toBe(false);
			expect(hasSelection(null)).toBe(false);
		});
	});

	describe('mergeSelections', () => {
		it('takes each field from the first source that has it', () => {
			expect(
				mergeSelections(
					{ ...empty, projectId: 'form-project' },
					{ projectId: 'saved-project', taskId: 'saved-task', note: 'saved note' }
				)
			).toEqual({ projectId: 'form-project', taskId: 'saved-task', note: 'saved note' });
		});

		it('counts a saved choice the selectors could not show yet', () => {
			expect(hasSelection(mergeSelections(empty, { teamId: 'saved-team' }))).toBe(true);
			expect(mergeSelections(empty, null, undefined)).toEqual({});
		});
	});

	describe('sameSelection', () => {
		it('compares the selectors, an empty selector matching a missing one', () => {
			expect(sameSelection({ ...empty, projectId: 'p' }, { projectId: 'p' })).toBe(true);
			expect(sameSelection(empty, {})).toBe(true);
			expect(sameSelection({ ...empty, projectId: 'p', teamId: 't' }, { projectId: 'p' })).toBe(false);
			expect(sameSelection({ ...empty, projectId: 'other' }, { projectId: 'p' })).toBe(false);
		});

		it('leaves the note aside', () => {
			expect(sameSelection({ ...empty, note: 'typed' }, {})).toBe(true);
		});
	});

	describe('keptSelection', () => {
		it('keeps what the form still has as applied, the note included', () => {
			expect(
				keptSelection(
					{ clientId: 'c', projectId: 'changed', teamId: '', taskId: 't', note: 'n' },
					{ clientId: 'c', projectId: 'p', taskId: 't', note: 'n' }
				)
			).toEqual({ clientId: 'c', taskId: 't', note: 'n' });
			expect(keptSelection(empty, null)).toEqual({});
		});
	});
});
