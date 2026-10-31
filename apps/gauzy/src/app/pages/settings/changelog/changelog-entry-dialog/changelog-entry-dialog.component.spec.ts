import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { NbDialogRef, NbIconLibraries } from '@nebular/theme';
import { Subject, of, throwError } from 'rxjs';
import { IChangelog } from '@gauzy/contracts';
import { ChangelogService, ErrorHandlingService, ToastrService } from '@gauzy/ui-core/core';
import { ChangelogEntryDialogComponent } from './changelog-entry-dialog.component';

/**
 * The dialog validates the entry, saves it itself and closes with the saved entry; a refused or failed save
 * keeps the dialog open with what was typed.
 */
describe('ChangelogEntryDialogComponent', () => {
	const existing: IChangelog = {
		id: 'news-1',
		title: 'Dark mode',
		icon: 'moon-outline',
		date: new Date('2026-08-05T00:00:00.000Z'),
		content: 'Easier on the eyes.',
		learnMoreUrl: 'https://gauzy.co/blog/dark-mode',
		imageUrl: '',
		isFeature: false
	};

	let dialogRef: { close: jest.Mock };
	let changelogService: { create: jest.Mock; update: jest.Mock };
	let toastrService: { danger: jest.Mock };
	let errorHandlingService: { handleError: jest.Mock };
	/** The icons the app can draw. */
	const ICONS = new Set(['moon-outline', 'star-outline', 'flash-outline']);
	const iconLibraries = { getIcon: (name: string) => (ICONS.has(name) ? { name } : null) };
	let component: ChangelogEntryDialogComponent;

	const open = (entry: IChangelog | null): ChangelogEntryDialogComponent => {
		component = new ChangelogEntryDialogComponent(
			new FormBuilder(),
			dialogRef as unknown as NbDialogRef<ChangelogEntryDialogComponent>,
			changelogService as unknown as ChangelogService,
			toastrService as unknown as ToastrService,
			errorHandlingService as unknown as ErrorHandlingService,
			iconLibraries as unknown as NbIconLibraries,
			{ markForCheck: jest.fn() } as unknown as ChangeDetectorRef
		);
		component.entry = entry;
		component.ngOnInit();
		return component;
	};

	beforeEach(() => {
		dialogRef = { close: jest.fn() };
		changelogService = {
			create: jest.fn((input: IChangelog) => of({ id: 'news-2', ...input })),
			update: jest.fn((id: string, input: IChangelog) => of({ id, ...input }))
		};
		toastrService = { danger: jest.fn() };
		errorHandlingService = { handleError: jest.fn() };
	});

	it('does not save an entry without a title or text, and shows what is missing', async () => {
		open(null);

		await component.save();

		expect(changelogService.create).not.toHaveBeenCalled();
		expect(component.invalid('title')).toBe(true);
		expect(component.invalid('content')).toBe(true);
		expect(component.invalid('date')).toBe(false);
	});

	it('does not save a title, icon or text made only of spaces, since they are saved trimmed', async () => {
		open(existing);
		component.form.patchValue({ title: '   ', content: ' \t ', icon: '  ' });

		await component.save();

		expect(changelogService.update).not.toHaveBeenCalled();
		expect(component.form.get('title').errors).toEqual({ required: true });
		expect(component.form.get('content').errors).toEqual({ required: true });
		expect(component.form.get('icon').errors).toEqual({ required: true });
	});

	it('does not save an icon the app cannot draw, and previews the default icon meanwhile', async () => {
		open(existing);
		component.form.patchValue({ icon: 'moon-outlin' });

		await component.save();

		expect(changelogService.update).not.toHaveBeenCalled();
		expect(component.form.get('icon').errors).toEqual({ unknownIcon: true });
		expect(component.invalid('icon')).toBe(true);
		expect(component.preview.icon).toBe('star-outline');

		component.form.patchValue({ icon: 'flash-outline' });
		expect(component.form.get('icon').errors).toBeNull();
		expect(component.preview.icon).toBe('flash-outline');
	});

	it('refuses links that are not full http(s) addresses, and text longer than MySQL keeps', async () => {
		open(existing);
		component.form.patchValue({ learnMoreUrl: 'javascript:alert(1)', imageUrl: 'https:gauzy.co/logo.png' });

		await component.save();

		expect(changelogService.update).not.toHaveBeenCalled();
		expect(component.form.get('learnMoreUrl').errors).toEqual({ httpUrl: true });
		expect(component.form.get('imageUrl').errors).toEqual({ httpUrl: true });

		component.form.patchValue({ learnMoreUrl: '', imageUrl: '', content: 'x'.repeat(256) });
		expect(component.form.get('content').errors).toEqual(expect.objectContaining({ maxlength: expect.anything() }));
	});

	it('adds a new entry, of the kind it was opened for, and closes with it', async () => {
		open({ isFeature: true });
		component.form.patchValue({ title: ' Time tracking ', content: 'Track every minute.', date: '2026-10-31' });

		await component.save();

		expect(changelogService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Time tracking',
				content: 'Track every minute.',
				date: new Date('2026-10-31T00:00:00.000Z'),
				isFeature: true
			})
		);
		expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: 'news-2' }));
	});

	it('saves an edited entry under its id, sending a cleared link as empty', async () => {
		open(existing);
		component.form.patchValue({ title: 'Dark mode, everywhere', learnMoreUrl: '' });

		await component.save();

		expect(changelogService.update).toHaveBeenCalledWith(
			'news-1',
			expect.objectContaining({ title: 'Dark mode, everywhere', learnMoreUrl: '', date: existing.date })
		);
		expect(changelogService.create).not.toHaveBeenCalled();
		expect(dialogRef.close).toHaveBeenCalled();
	});

	it("says only the installation's operator may change entries when the API refuses, and stays open", async () => {
		changelogService.update.mockReturnValueOnce(throwError(() => ({ status: 403 })));
		open(existing);

		await component.save();

		expect(toastrService.danger).toHaveBeenCalledWith('CHANGELOG_MENU.MANAGE.FORBIDDEN');
		expect(errorHandlingService.handleError).not.toHaveBeenCalled();
		expect(dialogRef.close).not.toHaveBeenCalled();
		expect(component.saving).toBe(false);
		expect(component.form.value.title).toBe('Dark mode');
	});

	it("shows the API's message for any other failure, and stays open", async () => {
		const failure = { status: 500, error: { message: 'Database is down' } };
		changelogService.update.mockReturnValueOnce(throwError(() => failure));
		open(existing);

		await component.save();

		expect(errorHandlingService.handleError).toHaveBeenCalledWith(failure);
		expect(toastrService.danger).not.toHaveBeenCalled();
		expect(dialogRef.close).not.toHaveBeenCalled();
	});

	it('ignores a second save while the first is under way', async () => {
		const response = new Subject<IChangelog>();
		changelogService.update.mockReturnValueOnce(response);
		open(existing);

		const first = component.save();
		await component.save();
		response.next(existing);
		response.complete();
		await first;

		expect(changelogService.update).toHaveBeenCalledTimes(1);
		expect(dialogRef.close).toHaveBeenCalledTimes(1);
	});

	it('previews the card as it is typed, without a link until it is a full address', () => {
		open(existing);
		expect(component.preview.learnMoreUrl).toBe('https://gauzy.co/blog/dark-mode');

		component.form.patchValue({ title: 'Darker mode', learnMoreUrl: 'https://' });

		expect(component.preview.title).toBe('Darker mode');
		expect(component.preview.learnMoreUrl).toBe('');
	});
});
