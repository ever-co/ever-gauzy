import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubAuthorizationComponent } from './authorization.component';

describe('GithubAuthorizationComponent', () => {
	let component: GithubAuthorizationComponent;
	let fixture: ComponentFixture<GithubAuthorizationComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [GithubAuthorizationComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GithubAuthorizationComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
