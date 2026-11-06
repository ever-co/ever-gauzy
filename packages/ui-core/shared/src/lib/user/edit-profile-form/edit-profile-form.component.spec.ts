import { UntypedFormBuilder } from '@angular/forms';
import { of, Subject } from 'rxjs';
import { RolesEnum } from '@gauzy/contracts';
import { EditProfileFormComponent } from './edit-profile-form.component';

/**
 * The user edit page's Main tab (ngx-profile): a new photo shows at once and stays with the form (so a Save sends
 * it), only the photo is sent with it, the signed-in user's session takes it only once saved and only for their own
 * profile, a save cannot be sent twice (role lookup included), and the role reads as a label.
 */
describe('EditProfileFormComponent', () => {
	const ADMIN = { id: 'admin-1', imageId: 'admin-image', imageUrl: 'admin.png', email: 'admin@ever.co' };
	const IMAGE = { id: 'image-2', fullUrl: 'https://cdn/new.png' } as any;

	/** The form with its services faked; `selectedUser` is whom the page edits (absent: the signed-in user). */
	const formFor = (selectedUser?: { id: string }, update = jest.fn(async () => ({ imageUrl: IMAGE.fullUrl }))) => {
		const component = Object.create(EditProfileFormComponent.prototype) as EditProfileFormComponent &
			Record<string, any>;
		component.form = EditProfileFormComponent.buildForm(new UntypedFormBuilder());
		component.form.patchValue({ email: 'ann@ever.co', firstName: 'Ann', lastName: 'Brown' });
		component.saving = false;
		component.avatarFailed = true;
		component.allowRoleChange = false;
		component.selectedUser = selectedUser as any;
		component['_store'] = { user: { ...ADMIN }, userId: ADMIN.id, preferredLanguage: 'en' };
		component['_userService'] = { update };
		component['_toastrService'] = { success: jest.fn(), error: jest.fn(), danger: jest.fn() };
		component['_errorHandler'] = { handleError: jest.fn() };
		component['_roleService'] = { getRoleByOptions: jest.fn(() => of({ id: 'role-1', name: 'EMPLOYEE' })) };
		component.userSubmitted = { emit: jest.fn() } as any;
		return { component, update };
	};

	describe('a new photo', () => {
		it('for another user: saved on that user, shown at once, and the admin’s own session left as it was', async () => {
			const { component, update } = formFor({ id: 'user-2' });

			await component.updateImageAsset(IMAGE);

			expect(update).toHaveBeenCalledWith('user-2', { imageId: 'image-2' });
			expect(component['_store'].user).toEqual(ADMIN);
			expect(component.form.get('imageId').value).toBe('image-2');
			expect(component.form.get('imageUrl').value).toBe('https://cdn/new.png');
			expect(component.avatarFailed).toBe(false);
		});

		it('CONTROL: for the signed-in user’s own profile, their session takes the new photo', async () => {
			const { component, update } = formFor();

			await component.updateImageAsset(IMAGE);

			expect(update).toHaveBeenCalledWith('admin-1', { imageId: 'image-2' });
			expect(component['_store'].user.imageId).toBe('image-2');
			expect(component['_store'].user.imageUrl).toBe('https://cdn/new.png');
		});

		it('sends only the photo, even where the role can change: a role picked in the form waits for Save', async () => {
			const { component, update } = formFor({ id: 'user-2' });
			component.allowRoleChange = true;
			component.form.patchValue({ role: { name: 'ADMIN' } });

			await component.updateImageAsset(IMAGE);

			expect(update).toHaveBeenCalledWith('user-2', { imageId: 'image-2' });
			expect(component['_roleService'].getRoleByOptions).not.toHaveBeenCalled();
		});

		it('when the photo cannot be saved: says so, keeps it in the form for Save, and leaves the session as it was', async () => {
			const { component } = formFor(
				undefined,
				jest.fn(async () => {
					throw new Error('500');
				})
			);

			await component.updateImageAsset(IMAGE);

			expect(component['_errorHandler'].handleError).toHaveBeenCalled();
			expect(component['_store'].user).toEqual(ADMIN);
			expect(component.form.get('imageId').value).toBe('image-2');
		});

		it('CONTROL: an admin editing themselves through the users page counts as their own profile', async () => {
			const { component } = formFor({ id: 'admin-1' });

			await component.updateImageAsset(IMAGE);

			expect(component['_store'].user.imageUrl).toBe('https://cdn/new.png');
		});
	});

	describe('saving', () => {
		it('sends the profile once, and frees the button when it lands', async () => {
			let land: () => void = () => undefined;
			const update = jest.fn(() => new Promise((resolve) => (land = () => resolve({}))));
			const { component } = formFor({ id: 'user-2' }, update);

			const first = component.submitForm();
			expect(component.saving).toBe(true);
			await component.submitForm(); // a second click while the first is on its way
			land();
			await first;

			expect(update).toHaveBeenCalledTimes(1);
			expect(update).toHaveBeenCalledWith('user-2', expect.objectContaining({ email: 'ann@ever.co' }));
			expect(component.userSubmitted.emit).toHaveBeenCalledTimes(1);
			expect(component.saving).toBe(false);
		});

		it('sends the photo shown with the rest', async () => {
			const { component, update } = formFor({ id: 'user-2' });
			component.form.patchValue({ imageId: 'image-2' });

			await component.submitForm();

			expect(update).toHaveBeenCalledWith('user-2', expect.objectContaining({ imageId: 'image-2' }));
		});

		it('where the role can change, sends once even when clicked again during the role lookup', async () => {
			const role$ = new Subject<any>();
			const { component, update } = formFor({ id: 'user-2' });
			component.allowRoleChange = true;
			component.form.patchValue({ role: { name: 'EMPLOYEE' } });
			component['_roleService'].getRoleByOptions = jest.fn(() => role$);

			const first = component.submitForm();
			expect(component.saving).toBe(true);
			await component.submitForm(); // a second click while the role is looked up
			role$.next({ id: 'role-1', name: 'EMPLOYEE' });
			role$.complete();
			await first;

			expect(update).toHaveBeenCalledTimes(1);
			expect(update).toHaveBeenCalledWith(
				'user-2',
				expect.objectContaining({ role: { id: 'role-1', name: 'EMPLOYEE' } })
			);
			expect(component.saving).toBe(false);
		});

		it('reports a failed role lookup and frees the button', async () => {
			const { component, update } = formFor({ id: 'user-2' });
			component.allowRoleChange = true;
			component.form.patchValue({ role: { name: 'EMPLOYEE' } });
			component['_roleService'].getRoleByOptions = jest.fn(() => {
				throw new Error('404');
			});

			await component.submitForm();

			expect(update).not.toHaveBeenCalled();
			expect(component['_errorHandler'].handleError).toHaveBeenCalled();
			expect(component.saving).toBe(false);
		});

		it('frees the button when the save fails, and reports the error', async () => {
			const { component } = formFor(
				{ id: 'user-2' },
				jest.fn(async () => {
					throw new Error('400');
				})
			);

			await component.submitForm();

			expect(component['_errorHandler'].handleError).toHaveBeenCalled();
			expect(component.saving).toBe(false);
		});

		it('sends nothing while the form is invalid', async () => {
			const { component, update } = formFor({ id: 'user-2' });
			component.form.patchValue({ email: '' });

			await component.submitForm();

			expect(update).not.toHaveBeenCalled();
		});
	});

	describe('the role label', () => {
		it.each([
			[RolesEnum.ADMIN, { key: 'USERS_PAGE.ROLE.ADMIN', text: 'ADMIN' }],
			[RolesEnum.DATA_ENTRY, { key: 'USERS_PAGE.ROLE.DATA_ENTRY', text: 'DATA_ENTRY' }],
			// No USERS_PAGE.ROLE string: shown by its name, never as a raw key.
			[RolesEnum.INTERVIEWER, { text: 'INTERVIEWER' }],
			['SALES_LEAD', { text: 'SALES LEAD' }]
		])('reads %s', (name, label) => {
			const { component } = formFor();
			component.role = { name } as any;

			expect(component.roleLabel).toEqual(label);
		});

		it('is absent without a role', () => {
			const { component } = formFor();
			component.role = undefined;

			expect(component.roleLabel).toBeNull();
		});
	});

	describe('the identity panel facts', () => {
		const withProfile = (profile: Record<string, unknown>) => {
			const { component } = formFor();
			component.profile = profile as any;
			return component;
		};

		it('reads a user without the active flag, or with it set, as active; and one set inactive as inactive', () => {
			expect(withProfile({}).isActiveAccount).toBe(true);
			expect(withProfile({ isActive: true }).isActiveAccount).toBe(true);
			expect(withProfile({ isActive: false }).isActiveAccount).toBe(false);
		});

		it('names the preferred language, and has none when it is not set', () => {
			expect(withProfile({ preferredLanguage: 'fr' }).languageName).toBe('French');
			expect(withProfile({}).languageName).toBeNull();
		});

		it('tells the user’s local time in their time zone and format, and none for a time zone it cannot read', () => {
			expect(withProfile({ timeZone: 'Africa/Kinshasa', timeFormat: 24 }).localTime).toMatch(/^\d{2}:\d{2}$/);
			expect(withProfile({ timeZone: 'Africa/Kinshasa', timeFormat: 12 }).localTime).toMatch(/AM|PM/i);
			expect(withProfile({ timeZone: 'Not/AZone' }).localTime).toBeNull();
			expect(withProfile({}).localTime).toBeNull();
		});

		it('labels the time format, and has none when it is not set', () => {
			expect(withProfile({ timeFormat: 12 }).timeFormatKey).toBe('USERS_PAGE.EDIT_USER.TIME_FORMAT_12');
			expect(withProfile({ timeFormat: 24 }).timeFormatKey).toBe('USERS_PAGE.EDIT_USER.TIME_FORMAT_24');
			expect(withProfile({}).timeFormatKey).toBeNull();
		});
	});
});
