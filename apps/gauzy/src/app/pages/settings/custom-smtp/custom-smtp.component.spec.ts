import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomSmtpComponent } from './custom-smtp.component';

describe('CustomSmtpComponent', () => {
	let component: CustomSmtpComponent;
	let fixture: ComponentFixture<CustomSmtpComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [CustomSmtpComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(CustomSmtpComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
