import { shouldSelectUrlProject } from './project-selector.utils';

describe('shouldSelectUrlProject', () => {
	it('does nothing when the URL names no project', () => {
		expect(shouldSelectUrlProject(undefined, null, false)).toBe(false);
		expect(shouldSelectUrlProject(null, null, true)).toBe(false);
		expect(shouldSelectUrlProject('', null, true)).toBe(false);
	});

	it("always follows the URL in the page's global selector", () => {
		expect(shouldSelectUrlProject('page-project', null, false)).toBe(true);
		expect(shouldSelectUrlProject('page-project', 'other-project', false)).toBe(true);
	});

	describe("in a form's selector", () => {
		it('starts from the URL project while nothing is picked', () => {
			expect(shouldSelectUrlProject('page-project', null, true)).toBe(true);
			expect(shouldSelectUrlProject('page-project', undefined, true)).toBe(true);
			// "All Projects" has an empty ID; a multiple selector wraps an empty value in an array.
			expect(shouldSelectUrlProject('page-project', '', true)).toBe(true);
			expect(shouldSelectUrlProject('page-project', [], true)).toBe(true);
			expect(shouldSelectUrlProject('page-project', [null], true)).toBe(true);
		});

		it('keeps a project already picked, or already on the record being edited', () => {
			expect(shouldSelectUrlProject('page-project', 'picked-project', true)).toBe(false);
			expect(shouldSelectUrlProject('page-project', ['picked-project'], true)).toBe(false);
		});
	});
});
