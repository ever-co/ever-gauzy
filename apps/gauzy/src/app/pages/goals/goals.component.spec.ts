import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalsComponent } from './goals.component';

describe('GoalsComponent', () => {
	let component: GoalsComponent;
	let fixture: ComponentFixture<GoalsComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [GoalsComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GoalsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
