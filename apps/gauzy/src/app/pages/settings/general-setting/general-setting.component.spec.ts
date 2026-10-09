import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ITenant, RolesEnum } from '@gauzy/contracts';
import { Store, TenantService, TenantUiPreferencesService, ToastrService } from '@gauzy/ui-core/core';
import { GeneralSettingComponent } from './general-setting.component';

/**
 * Under MikroORM `GET /tenant` returns the eagerly loaded `image` but leaves the `imageId` mirror empty.
 * The tenant profile form must take the logo id from `image`, or a plain save (a rename) sends
 * `imageId: null` and the API unlinks the tenant's logo.
 */
describe('GeneralSettingComponent tenant profile', () => {
	const image = { id: 'image-1', fullUrl: 'https://cdn.example/logo.png' };
	// The shape `GET /tenant` answers with under MikroORM: `image` loaded, `imageId` absent.
	const mikroOrmTenant = { id: 'tenant-1', name: 'Acme', logo: image.fullUrl, image } as unknown as ITenant;

	let tenantService: { getCurrent: jest.Mock; update: jest.Mock };
	let component: GeneralSettingComponent;

	beforeEach(() => {
		tenantService = { getCurrent: jest.fn().mockResolvedValue(mikroOrmTenant), update: jest.fn().mockResolvedValue({}) };
		const user = { id: 'user-1', role: { name: RolesEnum.SUPER_ADMIN }, tenant: { id: 'tenant-1' } };
		TestBed.configureTestingModule({
			providers: [
				{ provide: TenantService, useValue: tenantService },
				{ provide: TenantUiPreferencesService, useValue: { preferredUi: () => null, reload: jest.fn(), update: jest.fn() } },
				{ provide: ToastrService, useValue: { success: jest.fn(), danger: jest.fn() } },
				{
					provide: Store,
					useValue: {
						user,
						user$: new BehaviorSubject(user),
						userRolePermissions$: new BehaviorSubject([]),
						hasPermission: () => true,
						workspaces: [],
						selectedWorkspace: null
					}
				}
			]
		});
		component = TestBed.runInInjectionContext(() => new GeneralSettingComponent());
	});

	const load = () => (component as unknown as { loadTenant(): Promise<void> }).loadTenant();

	it('takes the logo id from the loaded image relation when imageId is empty', async () => {
		await load();

		expect(component.profileForm.getRawValue().imageId).toBe('image-1');
	});

	it('keeps the logo when only the name is changed and saved', async () => {
		await load();
		component.profileForm.patchValue({ name: 'Acme Ltd' });

		await component.onSaveProfile();

		expect(tenantService.update).toHaveBeenCalledWith({ name: 'Acme Ltd', imageId: 'image-1', logo: image.fullUrl });
	});

	it('keeps the loaded image when the re-read after a save fails', async () => {
		await load();
		tenantService.getCurrent.mockRejectedValueOnce(new Error('network'));

		await component.onSaveProfile();

		expect(component.tenant()?.image).toEqual(image);
		expect(component.profileForm.getRawValue().imageId).toBe('image-1');
	});

	it('still sends imageId null when the logo is removed', async () => {
		await load();
		component.onRemoveLogo();

		await component.onSaveProfile();

		expect(tenantService.update).toHaveBeenCalledWith({ name: 'Acme', imageId: null, logo: null });
	});
});
