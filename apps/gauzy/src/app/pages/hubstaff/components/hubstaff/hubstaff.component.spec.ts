import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HubstaffComponent } from './hubstaff.component';

describe('HubstaffComponent', () => {
	let component: HubstaffComponent;
	let fixture: ComponentFixture<HubstaffComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [HubstaffComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(HubstaffComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
