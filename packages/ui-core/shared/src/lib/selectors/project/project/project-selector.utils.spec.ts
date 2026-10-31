import { shouldSelectUrlProject, UrlProjectContext } from './project-selector.utils';

describe('shouldSelectUrlProject', () => {
	const context = (overrides: Partial<UrlProjectContext>): UrlProjectContext => ({
		urlProjectId: 'page-project',
		selected: null,
		skipGlobalChange: true,
		isFirstLoad: true,
		...overrides
	});

	it('does nothing when the URL names no project', () => {
		expect(shouldSelectUrlProject(context({ urlProjectId: undefined, skipGlobalChange: false }))).toBe(false);
		expect(shouldSelectUrlProject(context({ urlProjectId: null }))).toBe(false);
		expect(shouldSelectUrlProject(context({ urlProjectId: '' }))).toBe(false);
	});

	it("always follows the URL in the page's global selector", () => {
		expect(shouldSelectUrlProject(context({ skipGlobalChange: false }))).toBe(true);
		expect(shouldSelectUrlProject(context({ skipGlobalChange: false, selected: 'other-project' }))).toBe(true);
		expect(shouldSelectUrlProject(context({ skipGlobalChange: false, isFirstLoad: false }))).toBe(true);
	});

	describe("in a form's selector", () => {
		it('starts from the URL project on the first list, while nothing is picked', () => {
			expect(shouldSelectUrlProject(context({ selected: null }))).toBe(true);
			expect(shouldSelectUrlProject(context({ selected: undefined }))).toBe(true);
			// "All Projects" has an empty ID; a multiple selector wraps an empty value in an array.
			expect(shouldSelectUrlProject(context({ selected: '' }))).toBe(true);
			expect(shouldSelectUrlProject(context({ selected: [] }))).toBe(true);
			expect(shouldSelectUrlProject(context({ selected: [null] }))).toBe(true);
		});

		it('keeps a project already picked, or already on the record being edited', () => {
			expect(shouldSelectUrlProject(context({ selected: 'picked-project' }))).toBe(false);
			expect(shouldSelectUrlProject(context({ selected: ['picked-project'] }))).toBe(false);
		});

		it('never brings the URL project back on a later reload, even once the field was cleared', () => {
			expect(shouldSelectUrlProject(context({ isFirstLoad: false, selected: null }))).toBe(false);
			expect(shouldSelectUrlProject(context({ isFirstLoad: false, selected: 'picked-project' }))).toBe(false);
		});
	});
});
