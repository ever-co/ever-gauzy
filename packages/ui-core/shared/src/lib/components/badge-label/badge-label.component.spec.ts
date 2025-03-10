import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { BadgeLabelComponent } from './badge-label.component';

describe('BadgeLabelComponent', () => {
	let component: BadgeLabelComponent;
	let fixture: ComponentFixture<BadgeLabelComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [BadgeLabelComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(BadgeLabelComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
