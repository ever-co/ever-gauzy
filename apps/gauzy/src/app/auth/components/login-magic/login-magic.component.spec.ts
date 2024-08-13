import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxLoginMagicComponent } from './login-magic.component';

describe('NgxLoginMagicComponent', () => {
	let component: NgxLoginMagicComponent;
	let fixture: ComponentFixture<NgxLoginMagicComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [NgxLoginMagicComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(NgxLoginMagicComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
