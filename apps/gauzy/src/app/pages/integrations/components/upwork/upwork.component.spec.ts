import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UpworkComponent } from './upwork.component';

describe('UpworkComponent', () => {
	let component: UpworkComponent;
	let fixture: ComponentFixture<UpworkComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [UpworkComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(UpworkComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
