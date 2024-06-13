import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressStatusComponent } from './progress-status.component';

describe('ProgressStatusComponent', () => {
	let component: ProgressStatusComponent;
	let fixture: ComponentFixture<ProgressStatusComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ProgressStatusComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ProgressStatusComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
