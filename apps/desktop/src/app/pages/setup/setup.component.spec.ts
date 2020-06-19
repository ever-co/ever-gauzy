import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SetupComponent } from './setup.component';

describe('SetupComponent', () => {
	let component: SetupComponent;
	let fixture: ComponentFixture<SetupComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [SetupComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(SetupComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
