import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NbButtonModule, NbCardModule, NbDialogRef } from '@nebular/theme';
import { IImageAsset } from '@gauzy/contracts';
import { AttachReceiptComponent } from './attach-receipt.component';
import { PLACEHOLDER_RECEIPT } from '../expense-receipt.utils';

/** Stands in for the shared uploader, which talks to the file storage on its own. */
@Component({ selector: 'ngx-image-uploader', template: '' })
class ImageUploaderStubComponent {
	@Input() folder: string;
	@Output() changeHoverState = new EventEmitter<boolean>();
	@Output() uploadedImageAsset = new EventEmitter<IImageAsset>();
}

describe('AttachReceiptComponent — an expense without a receipt shows no receipt', () => {
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
	const saveButton = (): HTMLButtonElement => fixture.debugElement.queryAll(By.css('button'))[1].nativeElement;

	beforeEach(async () => {
		dialogRef.close.mockClear();
		await TestBed.configureTestingModule({
			declarations: [AttachReceiptComponent],
			imports: [NbCardModule, NbButtonModule, ImageUploaderStubComponent],
			providers: [{ provide: NbDialogRef, useValue: dialogRef }]
		}).compileComponents();
	});

	it('shows only the upload prompt and a hint when nothing is attached', () => {
		open(null);

		expect(image()).toBeNull();
		expect(hint().nativeElement.textContent.trim()).toBe('EXPENSES_PAGE.MUTATION.NO_RECEIPT');
		expect(saveButton().disabled).toBe(true);
	});

	it('never shows the sample invoice an older expense was saved with', () => {
		open(PLACEHOLDER_RECEIPT);

		expect(image()).toBeNull();
		expect(hint()).toBeTruthy();
	});

	it('shows a receipt that was really uploaded', () => {
		open('https://files.example.com/attach_receipts/receipt-42.png');

		expect(image().nativeElement.getAttribute('src')).toBe('https://files.example.com/attach_receipts/receipt-42.png');
		expect(hint()).toBeNull();
	});

	it('enables Save once an image is uploaded, and saves that image', () => {
		open(null);

		component.updateImageAsset({ id: 'asset-1', fullUrl: 'https://files.example.com/new.png' } as IImageAsset);
		fixture.detectChanges();

		expect(image().nativeElement.getAttribute('src')).toBe('https://files.example.com/new.png');
		expect(saveButton().disabled).toBe(false);

		saveButton().click();
		expect(dialogRef.close).toHaveBeenCalledWith('https://files.example.com/new.png');
	});
});
