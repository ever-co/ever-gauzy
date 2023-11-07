import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubSettingsComponent } from './settings.component';

describe('GithubSettingsComponent', () => {
	let component: GithubSettingsComponent;
	let fixture: ComponentFixture<GithubSettingsComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [GithubSettingsComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GithubSettingsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
