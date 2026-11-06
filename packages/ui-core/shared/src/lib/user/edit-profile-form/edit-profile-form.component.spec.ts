import { UntypedFormBuilder } from '@angular/forms';
import { RolesEnum } from '@gauzy/contracts';
import { EditProfileFormComponent } from './edit-profile-form.component';

/**
 * The user edit page's Main tab (ngx-profile): a new photo shows at once and stays with the form, an admin's own
 * session is left alone when they change another user's photo, a save cannot be sent twice, and the role reads as a
 * label.
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
});
