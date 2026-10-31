import { ListRequestGuard } from './list-request-guard';

/** A late answer must not put entries back into a selector's list emptied since, or for another organization. */
describe('ListRequestGuard', () => {
	let organizationId: string;
	let guard: ListRequestGuard;

	beforeEach(() => {
		organizationId = 'org-1';
		guard = new ListRequestGuard();
	});

	it('keeps the answer to a request for the list shown', () => {
		const isCurrent = guard.start(() => organizationId);

		expect(isCurrent()).toBe(true);
	});

	it('drops the answer to a request made before the list was emptied, and keeps the one made after', () => {
		const before = guard.start(() => organizationId);
		guard.invalidate();
		const after = guard.start(() => organizationId);

		expect(before()).toBe(false);
		expect(after()).toBe(true);
	});

	it('drops the answer to a request made for another organization', () => {
		const isCurrent = guard.start(() => organizationId);
		organizationId = 'org-2';

		expect(isCurrent()).toBe(false);
	});
});
