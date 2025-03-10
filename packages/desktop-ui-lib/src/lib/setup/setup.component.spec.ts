import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { SetupComponent } from './setup.component';

describe('SetupComponent', () => {
	let component: SetupComponent;
	let fixture: ComponentFixture<SetupComponent>;

	beforeEach(waitForAsync(() => {
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
