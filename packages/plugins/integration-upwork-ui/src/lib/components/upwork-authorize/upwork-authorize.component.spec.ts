import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { UpworkAuthorizeComponent } from './upwork-authorize.component';

describe('UpworkAuthorizeComponent', () => {
	let component: UpworkAuthorizeComponent;
	let fixture: ComponentFixture<UpworkAuthorizeComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [UpworkAuthorizeComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(UpworkAuthorizeComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
