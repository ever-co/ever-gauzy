import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubViewComponent } from './view.component';

describe('GithubViewComponent', () => {
	let component: GithubViewComponent;
	let fixture: ComponentFixture<GithubViewComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [GithubViewComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GithubViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
