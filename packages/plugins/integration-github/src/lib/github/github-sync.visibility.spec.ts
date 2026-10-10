import { isPublicRepositoryTask } from './github-sync.service';

/**
 * Both issue syncs (manual / automatic, and the webhook automation) used `public: repository.private` for the
 * task, the reverse of what the flag means.
 */
describe('isPublicRepositoryTask', () => {
	it('makes the task of a private repository private', () => {
		expect(isPublicRepositoryTask({ private: true })).toBe(false);
	});

	it('makes the task of a public repository public', () => {
		expect(isPublicRepositoryTask({ private: false })).toBe(true);
		expect(isPublicRepositoryTask({})).toBe(true);
	});
});
