import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxWhatsNewComponent } from './whats-new.component';

describe('NgxWhatsNewComponent', () => {
	let component: NgxWhatsNewComponent;
	let fixture: ComponentFixture<NgxWhatsNewComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [NgxWhatsNewComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(NgxWhatsNewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
