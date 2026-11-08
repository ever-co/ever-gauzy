import { ChangeDetectorRef } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { Observable, of, throwError } from 'rxjs';
import { IChangelog, IChangelogFindInput } from '@gauzy/contracts';
import { ChangelogService, ErrorHandlingService, ToastrService } from '@gauzy/ui-core/core';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';
import { ChangelogAdminComponent } from './changelog-admin.component';
import { ChangelogEntryDialogComponent } from './changelog-entry-dialog/changelog-entry-dialog.component';

/**
 * The page lists each kind of entry as its surface reads it, opens the entry form, and deletes and restores
 * entries, reading the list again after every change.
 */
describe('ChangelogAdminComponent', () => {
	// A current API names every row's product.
	const older: IChangelog = {
		id: 'news-1',
		title: 'Dark mode',
		date: new Date('2026-08-01T00:00:00.000Z'),
		platform: 'gauzy'
	};
	const newer: IChangelog = {
		id: 'news-2',
		title: 'Deals board',
		date: new Date('2026-10-31T00:00:00.000Z'),
		platform: 'gauzy'
	};
	const feature: IChangelog = { id: 'feature-1', title: 'Time tracking', isFeature: true, platform: 'gauzy' };

	let changelogService: { find: jest.Mock; delete: jest.Mock; recover: jest.Mock };
	let dialogService: { open: jest.Mock };
	let dialogResults: Map<unknown, unknown>;
	let toastrService: { success: jest.Mock; danger: jest.Mock };
	let errorHandlingService: { handleError: jest.Mock };
	let component: ChangelogAdminComponent;

	beforeEach(async () => {
		changelogService = {
			find: jest.fn(({ isFeature }: IChangelogFindInput) =>
				of({ items: isFeature ? [feature] : [older, newer], total: isFeature ? 1 : 2 })
			),
			delete: jest.fn((id: string) => of({ id })),
			recover: jest.fn((id: string) => of({ id }))
		};
		dialogResults = new Map<unknown, unknown>([[DeleteConfirmationComponent, 'ok']]);
		dialogService = {
			open: jest.fn((type: unknown) => ({ onClose: of(dialogResults.get(type)) }))
		};
		toastrService = { success: jest.fn(), danger: jest.fn() };
		errorHandlingService = { handleError: jest.fn() };
		component = new ChangelogAdminComponent(
			changelogService as unknown as ChangelogService,
			dialogService as unknown as NbDialogService,
			toastrService as unknown as ToastrService,
			errorHandlingService as unknown as ErrorHandlingService,
			{ markForCheck: jest.fn() } as unknown as ChangeDetectorRef
		);
		await component.load();
	});

	it("lists the What's New entries and the sign-up page's cards apart, newest first", () => {
		expect(changelogService.find).toHaveBeenCalledWith({ isFeature: 0 });
		expect(changelogService.find).toHaveBeenCalledWith({ isFeature: 1 });
		expect(component.sections.map(({ isFeature }) => isFeature)).toEqual([false, true]);
		expect(component.sections[0].entries.map(({ id }) => id)).toEqual(['news-2', 'news-1']);
		expect(component.sections[1].entries).toEqual([feature]);
		expect(component.loading).toBe(false);
	});

	it('offers a retry when the entries cannot be read', async () => {
		changelogService.find.mockReturnValueOnce(throwError(() => new Error('offline')));

		await component.load();

		expect(component.loadFailed).toBe(true);
		expect(component.loading).toBe(false);

		await component.load();
		expect(component.loadFailed).toBe(false);
	});

	it('keeps the newest read when an older one finishes late', async () => {
		let release: (value: unknown) => void;
		changelogService.find.mockReturnValueOnce(
			new Observable((subscriber) => {
				release = (value) => {
					subscriber.next(value);
					subscriber.complete();
				};
			})
		);
		const late = component.load();
		changelogService.find.mockReturnValue(of({ items: [newer], total: 1 }));
		await component.load();

		release({ items: [older], total: 1 });
		await late;

		expect(component.sections[0].entries).toEqual([newer]);
	});

	it('opens the form for a new entry of the section kind, and reads the list again once it is saved', async () => {
		dialogResults.set(ChangelogEntryDialogComponent, { ...feature, id: 'feature-2' });
		changelogService.find.mockClear();

		component.add(component.sections[1]);

		expect(dialogService.open).toHaveBeenCalledWith(ChangelogEntryDialogComponent, {
			context: { entry: { isFeature: true, platform: 'gauzy' } },
			closeOnBackdropClick: false,
			closeOnEsc: false
		});
		expect(toastrService.success).toHaveBeenCalledWith('CHANGELOG_MENU.MANAGE.SAVED_MESSAGE');
		expect(changelogService.find).toHaveBeenCalledTimes(2);
	});

	it('reads nothing again when the form is closed without saving', () => {
		changelogService.find.mockClear();

		component.edit(newer);

		expect(dialogService.open).toHaveBeenCalledWith(ChangelogEntryDialogComponent, {
			context: { entry: { ...newer, platform: 'gauzy' } },
			closeOnBackdropClick: false,
			closeOnEsc: false
		});
		expect(changelogService.find).not.toHaveBeenCalled();
		expect(toastrService.success).not.toHaveBeenCalled();
	});

	it('deletes a confirmed entry, lists it as restorable, and restores it', async () => {
		await component.remove(older);

		expect(changelogService.delete).toHaveBeenCalledWith('news-1');
		expect(toastrService.success).toHaveBeenCalledWith('CHANGELOG_MENU.MANAGE.DELETED_MESSAGE');
		expect(component.deleted).toEqual([older]);
		expect(component.busyId).toBeNull();

		await component.restore(older);

		expect(changelogService.recover).toHaveBeenCalledWith('news-1');
		expect(toastrService.success).toHaveBeenCalledWith('CHANGELOG_MENU.MANAGE.RESTORED_MESSAGE');
		expect(component.deleted).toEqual([]);
	});

	it('deletes nothing unless the deletion is confirmed', async () => {
		dialogResults.set(DeleteConfirmationComponent, undefined);

		await component.remove(older);

		expect(changelogService.delete).not.toHaveBeenCalled();
		expect(component.deleted).toEqual([]);
	});

	it("says only the installation's operator may change entries when the API refuses a delete", async () => {
		changelogService.delete.mockReturnValueOnce(throwError(() => ({ status: 403 })));

		await component.remove(older);

		expect(toastrService.danger).toHaveBeenCalledWith('CHANGELOG_MENU.MANAGE.FORBIDDEN');
		expect(errorHandlingService.handleError).not.toHaveBeenCalled();
		expect(component.deleted).toEqual([]);
		expect(component.busyId).toBeNull();
	});

	it("shows the API's message when a restore fails for another reason, and keeps the entry restorable", async () => {
		await component.remove(older);
		const failure = { status: 500 };
		changelogService.recover.mockReturnValueOnce(throwError(() => failure));

		await component.restore(older);

		expect(errorHandlingService.handleError).toHaveBeenCalledWith(failure);
		expect(component.deleted).toEqual([older]);
	});

	it("shows Gauzy's entries first, read without naming a product, as every Gauzy surface reads them", () => {
		expect(component.platform).toBe('gauzy');
		expect(changelogService.find.mock.calls.every(([query]) => !('platform' in query))).toBe(true);
	});

	it("shows another product's What's New entries only, read for that product", async () => {
		changelogService.find.mockClear();

		component.selectPlatform('ever-teams');
		await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve));

		expect(changelogService.find).toHaveBeenCalledTimes(1);
		expect(changelogService.find).toHaveBeenCalledWith({ isFeature: 0, platform: 'ever-teams' });
		expect(component.sections.map(({ isFeature }) => isFeature)).toEqual([false]);
	});

	it('ignores a product it does not know, and the one already shown', () => {
		changelogService.find.mockClear();

		component.selectPlatform('gauzy');
		component.selectPlatform('unknown-product');

		expect(changelogService.find).not.toHaveBeenCalled();
		expect(component.platform).toBe('gauzy');
	});

	it('adds an entry for the product shown, and edits an entry as the product it belongs to', async () => {
		component.selectPlatform('ever-works');
		await new Promise((resolve) => setTimeout(resolve));

		component.add(component.sections[0]);
		component.edit({ id: 'works-1', title: 'Old API answer' });
		component.edit({ id: 'teams-1', title: 'Moved', platform: 'ever-teams' });

		const contexts = dialogService.open.mock.calls
			.filter(([type]) => type === ChangelogEntryDialogComponent)
			.map(([, config]) => config.context.entry);
		expect(contexts).toEqual([
			{ isFeature: false, platform: 'ever-works' },
			{ id: 'works-1', title: 'Old API answer', platform: 'ever-works' },
			{ id: 'teams-1', title: 'Moved', platform: 'ever-teams' }
		]);
	});

	it("lists in another product's view only the rows that name it", async () => {
		const teams: IChangelog = { id: 'teams-1', title: 'Team chat', platform: 'ever-teams' };
		changelogService.find.mockReturnValueOnce(of({ items: [teams, newer], total: 2 }));

		component.selectPlatform('ever-teams');
		await new Promise((resolve) => setTimeout(resolve));

		expect(component.sections[0].entries).toEqual([teams]);
	});

	it("turns the other products off against an API that keeps one list for all, never showing Gauzy's news under them", async () => {
		const legacy = { id: 'legacy-1', title: 'Dark mode', date: new Date('2026-08-01T00:00:00.000Z') };
		changelogService.find.mockImplementation(() => of({ items: [legacy], total: 1 }));

		await component.load();

		expect(component.platformsSupported).toBe(false);
		expect(component.isPlatformAvailable('gauzy')).toBe(true);
		expect(component.isPlatformAvailable('ever-teams')).toBe(false);
		changelogService.find.mockClear();
		component.selectPlatform('ever-teams');
		expect(changelogService.find).not.toHaveBeenCalled();
		expect(component.platform).toBe('gauzy');
	});

	it('turns the other products back on once a later read shows the API keeps products apart', async () => {
		// One answer from an older API instance, as during a rolling deploy.
		const legacy = { id: 'legacy-1', title: 'Dark mode', date: new Date('2026-08-01T00:00:00.000Z') };
		changelogService.find.mockImplementationOnce(() => of({ items: [legacy], total: 1 }));
		await component.load();
		expect(component.platformsSupported).toBe(false);

		await component.load();

		expect(component.platformsSupported).toBe(true);
		expect(component.isPlatformAvailable('ever-teams')).toBe(true);
	});

	it('keeps what it knows when a read returns no rows', async () => {
		changelogService.find.mockImplementation(() => of({ items: [], total: 0 }));

		await component.load();

		expect(component.platformsSupported).toBe(true);
	});

	it('keeps what was deleted under the product it was deleted from', async () => {
		await component.remove(newer);
		expect(component.deletedHere.map(({ id }) => id)).toEqual(['news-2']);

		component.selectPlatform('ever-works');
		await new Promise((resolve) => setTimeout(resolve));

		expect(component.deletedHere).toEqual([]);
		expect(component.deleted).toEqual([newer]);
	});

	it('adds nothing under another product before the API has shown it keeps products apart', async () => {
		component.platformsSupported = null;
		component.selectPlatform('ever-teams');
		await new Promise((resolve) => setTimeout(resolve));
		component.platformsSupported = null;
		dialogService.open.mockClear();

		component.add(component.sections[0]);

		expect(component.canAdd).toBe(false);
		expect(dialogService.open).not.toHaveBeenCalled();
	});
});
