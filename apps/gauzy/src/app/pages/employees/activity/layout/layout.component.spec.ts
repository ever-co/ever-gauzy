import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivityLayoutComponent } from './layout.component';

describe('ActivityLayoutComponent', () => {
	let component: ActivityLayoutComponent;
	let fixture: ComponentFixture<ActivityLayoutComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ActivityLayoutComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ActivityLayoutComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
