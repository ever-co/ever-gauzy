import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { HubstaffComponent } from './hubstaff.component';

describe('HubstaffComponent', () => {
	let component: HubstaffComponent;
	let fixture: ComponentFixture<HubstaffComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [HubstaffComponent],
			teardown: { destroyAfterEach: false }
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
