import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NbButtonModule, NbCardModule, NbDialogRef, NbIconModule } from '@nebular/theme';
import { IImageAsset } from '@gauzy/contracts';
import { AttachReceiptComponent } from './attach-receipt.component';
import { PLACEHOLDER_RECEIPT } from '../expense-receipt.utils';

/** Stands in for the shared uploader, which talks to the file storage on its own. */
@Component({ selector: 'ngx-image-uploader', template: '' })
class ImageUploaderStubComponent {
	@Input() folder: string;
	@Input() accept: string;
	@Input() styles: Object;
	@Input() ariaLabel: string;
	@Input() disabled: boolean;
	@Output() changeHoverState = new EventEmitter<boolean>();
	@Output() uploadStarted = new EventEmitter<void>();
	@Output() uploadedImageAsset = new EventEmitter<IImageAsset>();
	@Output() uploadImageAssetError = new EventEmitter<any>();
}

const UPLOADED = 'https://files.example.com/attach_receipts/receipt-42.png';

describe('AttachReceiptComponent', () => {
	let fixture: ComponentFixture<AttachReceiptComponent>;
	let component: AttachReceiptComponent;
	const dialogRef = { close: jest.fn() };

	const open = (currentReceipt: string | null) => {
		fixture = TestBed.createComponent(AttachReceiptComponent);
		component = fixture.componentInstance;
		component.currentReceipt = currentReceipt;
		fixture.detectChanges();
	};

	const image = () => fixture.debugElement.query(By.css('img'));
	const hint = () => fixture.debugElement.query(By.css('.empty-hint'));
	const error = () => fixture.debugElement.query(By.css('.receipt-error'));
	const saveButton = (): HTMLButtonElement => fixture.debugElement.query(By.css('.save-button')).nativeElement;
	const removeButton = () => fixture.debugElement.query(By.css('.receipt-remove'));

	beforeEach(async () => {
		dialogRef.close.mockClear();
		await TestBed.configureTestingModule({
			declarations: [AttachReceiptComponent],
			imports: [NbCardModule, NbButtonModule, NbIconModule, ImageUploaderStubComponent],
			providers: [{ provide: NbDialogRef, useValue: dialogRef }]
		}).compileComponents();
	});

	describe('an expense without a receipt shows no receipt', () => {
		it('shows only the upload prompt and a hint when nothing is attached', () => {
			open(null);

			expect(image()).toBeNull();
			expect(hint().nativeElement.textContent.trim()).toBe('EXPENSE_VIEW.RECEIPT_UPLOAD_HINT');
			expect(removeButton()).toBeNull();
			expect(saveButton().disabled).toBe(true);
		});

		it('never shows the sample invoice an older expense was saved with', () => {
			open(PLACEHOLDER_RECEIPT);

			expect(image()).toBeNull();
			expect(hint()).toBeTruthy();
		});

		it('shows a receipt that was really uploaded, with nothing to save yet', () => {
			open(UPLOADED);

			expect(image().nativeElement.getAttribute('src')).toBe(UPLOADED);
			expect(hint()).toBeNull();
			expect(saveButton().disabled).toBe(true);
		});
	});

	describe('uploading', () => {
		it('enables Save once an image is uploaded, and saves that image', () => {
			open(null);

			component.onUploadStarted();
			component.updateImageAsset({ id: 'asset-1', fullUrl: 'https://files.example.com/new.png' } as IImageAsset);
			fixture.detectChanges();

			expect(image().nativeElement.getAttribute('src')).toBe('https://files.example.com/new.png');
			expect(saveButton().disabled).toBe(false);

			saveButton().click();
			expect(dialogRef.close).toHaveBeenCalledWith('https://files.example.com/new.png');
		});

		it('shows the upload in progress and holds Save until it ends', () => {
			open(null);

			component.onUploadStarted();
			fixture.detectChanges();

			expect(fixture.debugElement.query(By.css('.receipt-zone--busy'))).toBeTruthy();
			expect(saveButton().disabled).toBe(true);
		});

		// The regression this pins: the uploader was removed when "Uploading…" showed, so its result was
		// never delivered and the dialog stayed in "Uploading…" for good.
		it('keeps the uploader on the page, disabled, while its file uploads', () => {
			const uploaders = () =>
				fixture.debugElement
					.queryAll(By.directive(ImageUploaderStubComponent))
					.map((element) => element.componentInstance as ImageUploaderStubComponent);

			open(null);
			component.onUploadStarted();
			fixture.detectChanges();
			expect(uploaders().length).toBe(1);
			expect(uploaders()[0].disabled).toBe(true);

			uploaders()[0].uploadedImageAsset.emit({ id: 'asset-1', fullUrl: 'https://files.example.com/new.png' } as IImageAsset);
			fixture.detectChanges();
			expect(component.uploading).toBe(false);
			expect(image().nativeElement.getAttribute('src')).toBe('https://files.example.com/new.png');
		});

		it('keeps the Replace uploader on the page while a replacement uploads', () => {
			open(UPLOADED);
			component.onUploadStarted();
			fixture.detectChanges();

			const replace = fixture.debugElement.query(By.css('.receipt-replace ngx-image-uploader'));
			expect(replace).toBeTruthy();
			expect((replace.componentInstance as ImageUploaderStubComponent).disabled).toBe(true);
			expect(fixture.debugElement.query(By.css('.receipt-progress'))).toBeTruthy();
		});

		it('says why an upload failed, keeping the receipt it had', () => {
			open(UPLOADED);

			component.onUploadStarted();
			component.handleUploadError({ statusCode: 400, message: 'Unsupported file type' });
			fixture.detectChanges();

			expect(error().nativeElement.textContent.trim()).toBe('Unsupported file type');
			expect(image().nativeElement.getAttribute('src')).toBe(UPLOADED);
			expect(saveButton().disabled).toBe(true);
		});

		it('falls back to a generic message when the server gave no reason', () => {
			open(null);

			component.handleUploadError(null);
			fixture.detectChanges();

			expect(error().nativeElement.textContent.trim()).toBe('EXPENSE_VIEW.RECEIPT_UPLOAD_FAILED');
		});

		it('falls back to the generic message when the server sent something other than text', () => {
			open(null);

			component.handleUploadError({ statusCode: 500, message: { detail: 'boom' } } as any);
			fixture.detectChanges();

			expect(error().nativeElement.textContent.trim()).toBe('EXPENSE_VIEW.RECEIPT_UPLOAD_FAILED');
		});
	});

	describe('removing', () => {
		it('takes the receipt off the expense when saved', () => {
			open(UPLOADED);

			removeButton().nativeElement.click();
			fixture.detectChanges();

			expect(image()).toBeNull();
			expect(saveButton().disabled).toBe(false);

			saveButton().click();
			expect(dialogRef.close).toHaveBeenCalledWith(null);
		});

		it('keeps the receipt when the dialog is cancelled after removing it', () => {
			open(UPLOADED);

			component.removeReceipt();
			component.cancelReceipt();

			expect(dialogRef.close).toHaveBeenCalledWith(UPLOADED);
		});
	});
});
