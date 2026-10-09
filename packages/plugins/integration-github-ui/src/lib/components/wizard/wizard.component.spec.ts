import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubWizardComponent } from './wizard.component';
import { IntegrationGithubUiModule } from '../../integration-github-ui.module';
describe('GithubWizardComponent', () => {
	let component: GithubWizardComponent;
	let fixture: ComponentFixture<GithubWizardComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it, for the template's real scope.
			imports: [IntegrationGithubUiModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(GithubWizardComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
