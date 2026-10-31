import { FormControl } from '@angular/forms';
import {
	CHANGELOG_DEFAULT_ICON,
	IChangelogFormValue,
	httpUrlValidator,
	isForbidden,
	isHttpUrl,
	sortChangelogEntries,
	toChangelogFormValue,
	toChangelogInput,
	toChangelogPreview,
	toDateInputValue
} from './changelog-admin.utils';

describe('changelog admin utils', () => {
	const form = (overrides: Partial<IChangelogFormValue> = {}): IChangelogFormValue => ({
		title: 'Dark mode',
		icon: 'moon-outline',
		date: '2026-10-31',
		content: 'Easier on the eyes.',
		learnMoreUrl: '',
		imageUrl: '',
		isFeature: false,
		...overrides
	});

	describe('links', () => {
		it('takes only full http(s) addresses', () => {
			expect(isHttpUrl('https://gauzy.co/blog')).toBe(true);
			expect(isHttpUrl('http://localhost:4200')).toBe(true);
			expect(isHttpUrl('javascript:alert(1)')).toBe(false);
			expect(isHttpUrl('data:image/png;base64,AAAA')).toBe(false);
			expect(isHttpUrl('/pages/dashboard')).toBe(false);
			expect(isHttpUrl('gauzy.co')).toBe(false);
			expect(isHttpUrl('')).toBe(false);
			expect(isHttpUrl(undefined)).toBe(false);
		});

		it('lets an optional link be empty, and refuses anything but http(s)', () => {
			expect(httpUrlValidator(new FormControl(''))).toBeNull();
			expect(httpUrlValidator(new FormControl('  '))).toBeNull();
			expect(httpUrlValidator(new FormControl(null))).toBeNull();
			expect(httpUrlValidator(new FormControl(' https://gauzy.co '))).toBeNull();
			expect(httpUrlValidator(new FormControl('javascript:alert(1)'))).toEqual({ httpUrl: true });
			expect(httpUrlValidator(new FormControl('www.gauzy.co'))).toEqual({ httpUrl: true });
		});
	});

	describe('dates', () => {
		it('shows a stored date as the day a date input takes', () => {
			expect(toDateInputValue('2026-08-05T00:00:00.000Z')).toBe('2026-08-05');
			expect(toDateInputValue(new Date('2026-08-05T00:00:00.000Z'))).toBe('2026-08-05');
			expect(toDateInputValue('not a date')).toBe('');
			expect(toDateInputValue(null)).toBe('');
		});
	});

	describe('toChangelogFormValue', () => {
		it("starts the form from the entry's own values", () => {
			const value = toChangelogFormValue({
				id: 'news-1',
				title: 'Dark mode',
				icon: 'moon-outline',
				date: new Date('2026-08-05T00:00:00.000Z'),
				content: 'Easier on the eyes.',
				learnMoreUrl: 'https://gauzy.co',
				isFeature: true
			});

			expect(value).toEqual({
				title: 'Dark mode',
				icon: 'moon-outline',
				date: '2026-08-05',
				content: 'Easier on the eyes.',
				learnMoreUrl: 'https://gauzy.co',
				imageUrl: '',
				isFeature: true
			});
		});

		it("starts a new entry dated today (the user's day) with the default icon, of the kind asked for", () => {
			const today = new Date(2026, 9, 31, 23, 30);

			expect(toChangelogFormValue(null, today)).toEqual(
				expect.objectContaining({
					title: '',
					icon: CHANGELOG_DEFAULT_ICON,
					date: '2026-10-31',
					isFeature: false
				})
			);
			expect(toChangelogFormValue({ isFeature: true }, today).isFeature).toBe(true);
		});
	});

	describe('toChangelogInput', () => {
		it('trims the text and dates the entry at midnight UTC, as the seeded entries are', () => {
			const input = toChangelogInput(form({ title: '  Dark mode ', learnMoreUrl: ' https://gauzy.co ' }));

			expect(input).toEqual({
				title: 'Dark mode',
				icon: 'moon-outline',
				date: new Date('2026-10-31T00:00:00.000Z'),
				content: 'Easier on the eyes.',
				learnMoreUrl: 'https://gauzy.co',
				imageUrl: '',
				isFeature: false
			});
		});

		it('sends an emptied link as an empty string, so the save clears it, and never an empty icon', () => {
			const input = toChangelogInput(form({ learnMoreUrl: '   ', imageUrl: '', icon: ' ' }));

			expect(input.learnMoreUrl).toBe('');
			expect(input.imageUrl).toBe('');
			expect(input.icon).toBe(CHANGELOG_DEFAULT_ICON);
		});
	});

	describe('toChangelogPreview', () => {
		it('previews the card as typed', () => {
			const preview = toChangelogPreview(form({ learnMoreUrl: 'https://gauzy.co' }));

			expect(preview.title).toBe('Dark mode');
			expect(preview.date).toEqual(new Date('2026-10-31T00:00:00.000Z'));
			expect(preview.learnMoreUrl).toBe('https://gauzy.co');
		});

		it('leaves out a missing date and links that are not yet full http(s) addresses', () => {
			const preview = toChangelogPreview(
				form({ date: '', learnMoreUrl: 'javascript:alert(1)', imageUrl: 'https:' })
			);

			expect(preview.date).toBeUndefined();
			expect(preview.learnMoreUrl).toBe('');
			expect(preview.imageUrl).toBe('');
		});
	});

	it('tells a refusal from other failures', () => {
		expect(isForbidden({ status: 403 })).toBe(true);
		expect(isForbidden({ status: 401 })).toBe(false);
		expect(isForbidden(new Error('offline'))).toBe(false);
		expect(isForbidden(null)).toBe(false);
	});

	it('lists entries newest first without changing the list it is given', () => {
		const entries = [
			{ id: 'a', date: new Date('2026-08-01T00:00:00.000Z') },
			{ id: 'b', date: new Date('2026-10-31T00:00:00.000Z') },
			{ id: 'c', date: new Date('2026-09-15T00:00:00.000Z') }
		];

		expect(sortChangelogEntries(entries).map(({ id }) => id)).toEqual(['b', 'c', 'a']);
		expect(entries.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
		expect(sortChangelogEntries(undefined)).toEqual([]);
	});
});
