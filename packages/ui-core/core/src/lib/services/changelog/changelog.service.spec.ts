import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IChangelog } from '@gauzy/contracts';
import { ChangelogService } from './changelog.service';

/**
 * The service feeds the What's New sidebar (`changelogs$`) and the management page. Every change reads the
 * sidebar's entries again, so the sidebar shows it; the page's own reads leave the sidebar alone.
 */
describe('ChangelogService', () => {
	const published: IChangelog[] = [{ id: 'news-1', title: 'Old news' }];
	const refreshed: IChangelog[] = [{ id: 'news-2', title: 'Fresh news' }, ...published];

	let http: { get: jest.Mock; post: jest.Mock; put: jest.Mock; delete: jest.Mock };
	let service: ChangelogService;
	let shown: IChangelog[];

	beforeEach(() => {
		http = {
			get: jest.fn(() => of({ items: published, total: published.length })),
			post: jest.fn((_url: string, body: IChangelog) => of({ id: 'news-2', ...body })),
			put: jest.fn((url: string) => of({ id: url.split('/').slice(-2)[0] })),
			delete: jest.fn(() => of({ id: 'news-1' }))
		};
		service = new ChangelogService(http as unknown as HttpClient);
		service.changelogs$.subscribe((items) => (shown = items));
	});

	it('publishes what getAll reads, and find reads without publishing', async () => {
		await firstValueFrom(service.getAll({ isFeature: 0 }));
		expect(shown).toEqual(published);
		expect(http.get.mock.calls[0][0]).toMatch(/\/changelog$/);
		expect(http.get.mock.calls[0][1].params.get('isFeature')).toBe('0');

		http.get.mockReturnValueOnce(of({ items: [{ id: 'feature-1' }], total: 1 }));
		const features = await firstValueFrom(service.find({ isFeature: 1 }));

		expect(features.items).toEqual([{ id: 'feature-1' }]);
		expect(shown).toEqual(published);
	});

	it('adds, edits, takes down and brings back entries through the changelog API', async () => {
		const input = { title: 'Fresh news', content: 'Now with more news' };

		await firstValueFrom(service.create(input));
		await firstValueFrom(service.update('news-1', input));
		await firstValueFrom(service.delete('news-1'));
		await firstValueFrom(service.recover('news-1'));

		expect(http.post).toHaveBeenCalledWith(expect.stringMatching(/\/changelog$/), input);
		expect(http.put).toHaveBeenNthCalledWith(1, expect.stringMatching(/\/changelog\/news-1$/), input);
		expect(http.delete).toHaveBeenCalledWith(expect.stringMatching(/\/changelog\/news-1\/soft$/));
		expect(http.put).toHaveBeenNthCalledWith(2, expect.stringMatching(/\/changelog\/news-1\/recover$/), {});
	});

	it('reads the sidebar again after a change, with the sidebar query, and hands back the saved entry', async () => {
		await firstValueFrom(service.getAll({ isFeature: 0 }));
		http.get.mockReturnValueOnce(of({ items: refreshed, total: refreshed.length }));

		const saved = await firstValueFrom(service.create({ title: 'Fresh news' }));

		expect(saved).toEqual({ id: 'news-2', title: 'Fresh news' });
		expect(http.get).toHaveBeenCalledTimes(2);
		expect(http.get.mock.calls[1][1].params.get('isFeature')).toBe('0');
		expect(shown).toEqual(refreshed);
	});

	it('does not read anything after a change when the sidebar has not been shown', async () => {
		await firstValueFrom(service.delete('news-1'));

		expect(http.get).not.toHaveBeenCalled();
	});

	it('keeps a saved change saved when the sidebar cannot be read again', async () => {
		await firstValueFrom(service.getAll({ isFeature: 0 }));
		http.get.mockReturnValueOnce(throwError(() => new Error('offline')));

		const restored = await firstValueFrom(service.recover('news-1'));

		expect(restored).toEqual({ id: 'news-1' });
		expect(shown).toEqual(published);
	});

	it('fails the change itself when the API refuses it, without reading the sidebar', async () => {
		await firstValueFrom(service.getAll({ isFeature: 0 }));
		http.post.mockReturnValueOnce(throwError(() => ({ status: 403 })));

		await expect(firstValueFrom(service.create({ title: 'Nope' }))).rejects.toEqual({ status: 403 });
		expect(http.get).toHaveBeenCalledTimes(1);
	});
});
