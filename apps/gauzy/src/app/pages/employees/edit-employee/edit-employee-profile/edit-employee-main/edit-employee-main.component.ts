import {
	Component,
	OnDestroy,
	OnInit,
	ChangeDetectionStrategy,
	ElementRef,
	TemplateRef,
	ViewChild
} from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDialogService, NbPopoverDirective } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { IEmployee, IImageAsset, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { ImageAssetService, Store, ToastrService } from '@gauzy/ui-core/core';
import { EmployeeStore, ErrorHandlingService } from '@gauzy/ui-core/core';
import { ConfirmComponent } from '@gauzy/ui-core/shared';
import { AvatarCropDialogComponent } from './avatar-crop-dialog/avatar-crop-dialog.component';
import { AvatarMakerDialogComponent } from './avatar-maker/avatar-maker-dialog.component';

/** The image types the server stores as a photo, offered by the file picker. */
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];

/** The folder uploaded profile photos are stored in. */
const PHOTO_FOLDER = 'profile_pictures';

/** The route of a placeholder picture (the initial on a color) the API draws, at the end of a URL's path. */
const PLACEHOLDER_ROUTE = /\/api\/placeholder\/\d{1,4}x\d{1,4}\/(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The host of the generator the API's placeholder replaced, still named by some stored URLs. */
const DUMMY_IMAGE_HOST = /^(?:www\.)?dummyimage\.com$/i;

/**
 * Whether `url` is a placeholder picture. Only its host and path are read, as the API does: a photo URL whose
 * query happens to carry the placeholder path is still a photo.
 */
function isPlaceholderUrl(url: string): boolean {
	try {
		const { hostname, pathname } = new URL(url, document.baseURI);
		return PLACEHOLDER_ROUTE.test(pathname) || DUMMY_IMAGE_HOST.test(hostname);
	} catch {
		return false;
	}
}

/** What the crop and avatar dialogs close with: the picture, an error to show, or nothing when cancelled. */
type CropResult = { file?: File; error?: string } | undefined;

/**
 * This component contains the properties stored within the User Entity of an Employee.
 * Any property which is either stored directly in the Employee entity or as a relation of the Employee entity should NOT be put in this Component
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-main',
	templateUrl: './edit-employee-main.component.html',
	styleUrls: ['./edit-employee-main.component.scss'],
	providers: [ImageAssetService],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class EditEmployeeMainComponent implements OnInit, OnDestroy {
	organization: IOrganization;
	selectedEmployee: IEmployee;

	avatarFailed = false;
	/** A photo is being uploaded or removed. */
	photoBusy = false;

	readonly photoAccept = PHOTO_TYPES.join(',');

	@ViewChild('photoInput') photoInput: ElementRef<HTMLInputElement>;
	@ViewChild('photoViewer') photoViewer: TemplateRef<unknown>;
	@ViewChild(NbPopoverDirective) photoMenu: NbPopoverDirective;

	get workState(): 'active' | 'ended' | 'not-started' | null {
		const employee = this.selectedEmployee;
		if (!employee) return null;
		if (employee.endWork) return 'ended';
		return employee.startedWorkOn ? 'active' : 'not-started';
	}

	get hasEmploymentFacts(): boolean {
		const employee = this.selectedEmployee;
		return !!(employee?.employeeLevel || employee?.startedWorkOn || employee?.endWork);
	}

	get hasRateFacts(): boolean {
		const employee = this.selectedEmployee;
		return !!(
			employee?.payPeriod ||
			(employee?.billRateCurrency && employee?.billRateValue != null) ||
			employee?.reWeeklyLimit != null
		);
	}

	get hasJobFacts(): boolean {
		const employee = this.selectedEmployee;
		return employee?.jobSuccess != null || employee?.totalJobs != null;
	}

	/** The picture shown in the circle: the photo, the placeholder, or nothing when it cannot load. */
	get avatarUrl(): string | null {
		const url = this.form.get('imageUrl').value;
		return url && !this.avatarFailed ? url : null;
	}

	/**
	 * Whether the person has a real photo — uploaded, or from a sign-in provider — as opposed to the
	 * placeholder. Only a real photo can be viewed or removed; otherwise the avatar opens the file picker.
	 */
	get hasPhoto(): boolean {
		if (this.form.get('imageId').value) return true;
		const url = this.avatarUrl;
		return !!url && !isPlaceholderUrl(url);
	}

	/*
	 * Employee Main Mutation Form
	 */
	public form: UntypedFormGroup = EditEmployeeMainComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			username: [],
			email: [null, Validators.required],
			firstName: [],
			lastName: [],
			preferredLanguage: [],
			profile_link: [],
			imageId: [],
			imageUrl: [{ value: null, disabled: true }]
		});
	}

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _store: Store,
		private readonly _employeeStore: EmployeeStore,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _imageAssetService: ImageAssetService,
		private readonly _dialogService: NbDialogService,
		private readonly _toastrService: ToastrService,
		private readonly _translateService: TranslateService
	) {}

	ngOnInit() {
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._employeeStore.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				filter(([organization, employee]) => !!organization && !!employee),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployee = employee;
				}),
				tap(() => this._initializeFormValue(this.selectedEmployee)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Opens the avatar maker; the illustrated avatar it closes with becomes the person's picture, uploaded
	 * like a photo.
	 */
	async chooseAvatar(): Promise<void> {
		this.photoMenu?.hide();
		if (this.photoBusy) return;

		const dialog = this._dialogService.open(AvatarMakerDialogComponent, {
			closeOnBackdropClick: false,
			autoFocus: false
		});
		const result: CropResult = await firstValueFrom(dialog.onClose);
		if (result?.error) {
			this._toastrService.danger(result.error);
			return;
		}
		if (result?.file) {
			await this._uploadPhoto(result.file);
		}
	}

	/** Opens the file picker. */
	choosePhoto(): void {
		this.photoMenu?.hide();
		if (this.photoBusy) return;
		this.photoInput?.nativeElement.click();
	}

	/** Shows the photo large. */
	viewPhoto(): void {
		this.photoMenu?.hide();
		if (!this.avatarUrl) return;
		this._dialogService.open(this.photoViewer, { closeOnBackdropClick: true, autoFocus: false });
	}

	/**
	 * A file was picked: frame it in the crop dialog, then upload the framed photo.
	 */
	async onPhotoPicked(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		// Cleared so picking the same file again still reports a change.
		input.value = '';
		if (!file) return;

		if (!PHOTO_TYPES.includes(file.type)) {
			this._toastrService.danger('EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.UNSUPPORTED');
			return;
		}

		const dialog = this._dialogService.open(AvatarCropDialogComponent, {
			context: { file },
			closeOnBackdropClick: false,
			autoFocus: false
		});
		const result: CropResult = await firstValueFrom(dialog.onClose);
		if (result?.error) {
			this._toastrService.danger(result.error);
			return;
		}
		if (result?.file) {
			await this._uploadPhoto(result.file);
		}
	}

	/**
	 * Removes the photo, after asking. The server replaces it with the placeholder (the initial of the name).
	 */
	async removePhoto(): Promise<void> {
		this.photoMenu?.hide();
		if (this.photoBusy) return;

		const dialog = this._dialogService.open(ConfirmComponent, {
			context: {
				data: {
					title: this._translate('EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.REMOVE_TITLE'),
					message: this._translate('EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.REMOVE_MESSAGE'),
					yesText: this._translate('EMPLOYEES_PAGE.EDIT_EMPLOYEE.PHOTO.REMOVE')
				}
			}
		});
		if (!(await firstValueFrom(dialog.onClose))) return;

		this.photoBusy = true;
		try {
			this.avatarFailed = false;
			// Cleared here at once, like an upload, so the circle does not keep the old photo until the reload.
			this.form.patchValue({ imageId: null, imageUrl: null });
			// `imageUrl: null` alongside `imageId: null` is what tells the server the photo is removed, rather
			// than a form save that merely carries an empty `imageId`.
			await this._employeeStore.updateUserForm({ imageId: null, image: null, imageUrl: null });
		} catch (error) {
			this._errorHandlingService.handleError(error);
		} finally {
			this.photoBusy = false;
		}
	}

	/**
	 * Handles errors that occur during image upload.
	 *
	 * @param error - The error object to handle.
	 */
	handleImageUploadError(error: any) {
		// Delegate error handling to the _errorHandlingService
		this._errorHandlingService.handleError(error);
	}

	/**
	 * Upload employee image/avatar
	 *
	 * @param image
	 */
	async updateImageAsset(image: IImageAsset) {
		try {
			if (image) {
				this.avatarFailed = false;
				// The store round-trip does come back here — userForm$ drives the user
				// update, whose `finally` refetches the employee and re-emits
				// selectedEmployee$, which re-runs _initializeFormValue. But that is a
				// whole request away, and `imageUrl` is what the <img> binds to, so
				// patch it now rather than showing the old avatar until the reload
				// lands. `imageId` goes with it: submitForm() posts the form value, so
				// saving before the reload would otherwise revert to the old asset.
				this.form.patchValue({
					imageId: image.id,
					imageUrl: image.fullUrl || image.url
				});
				// Update user form data in store (assuming updateUserForm is async). `imageUrl` is left out
				// (`undefined` is not sent): the store merges every change, so an `imageUrl: null` left by an
				// earlier photo removal would otherwise go with the new photo and empty the stored picture URL.
				await this._employeeStore.updateUserForm({
					imageId: image.id,
					image,
					imageUrl: undefined
				});
			}
		} catch (error) {
			// Handle and log errors
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Submit employee main profile
	 *
	 * @returns
	 */
	async submitForm() {
		if (this.form.invalid || !this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;

		const values = {
			organizationId,
			tenantId,
			...(this.form.valid ? this.form.value : {})
		};

		// Update user form data in store (assuming updateUserForm is async)
		await this._employeeStore.updateUserForm(values);
		await this._employeeStore.updateEmployeeForm(values);
	}

	/**
	 * Uploads the framed photo and makes it the person's avatar.
	 */
	private async _uploadPhoto(file: File): Promise<void> {
		this.photoBusy = true;
		try {
			const image = await this._imageAssetService.upload(file, PHOTO_FOLDER, {
				tenantId: this.organization?.tenantId,
				organizationId: this.organization?.id
			});
			await this.updateImageAsset(image);
		} catch (error) {
			this.handleImageUploadError(error);
		} finally {
			this.photoBusy = false;
		}
	}

	private _translate(key: string): string {
		return this._translateService.instant(key);
	}

	/**
	 * Initialize the form values with the given employee's data.
	 *
	 * @param employee - The employee whose data will be used to initialize the form.
	 */
	private _initializeFormValue(employee: IEmployee) {
		this.avatarFailed = false;
		// Patch the form with the employee's user data
		this.form.patchValue({
			username: employee.user.username,
			email: employee.user.email,
			firstName: employee.user.firstName,
			lastName: employee.user.lastName,
			imageUrl: employee.user.image?.fullUrl || employee.user.imageUrl,
			imageId: employee.user.imageId,
			preferredLanguage: employee.user.preferredLanguage,
			profile_link: employee.profile_link
		});
	}

	ngOnDestroy() {}
}
