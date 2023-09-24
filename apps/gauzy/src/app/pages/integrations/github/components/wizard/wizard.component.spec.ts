import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubWizardComponent } from './wizard.component';

describe('GithubWizardComponent', () => {
	let component: GithubWizardComponent;
	let fixture: ComponentFixture<GithubWizardComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [GithubWizardComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GithubWizardComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
