import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { UpworkComponent } from './upwork.component';

describe('UpworkComponent', () => {
	let component: UpworkComponent;
	let fixture: ComponentFixture<UpworkComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [UpworkComponent],
			teardown: { destroyAfterEach: false }
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
