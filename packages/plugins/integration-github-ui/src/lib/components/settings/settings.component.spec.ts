import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GithubSettingsComponent } from './settings.component';
import { IntegrationGithubUiModule } from '../../integration-github-ui.module';
describe('GithubSettingsComponent', () => {
	let component: GithubSettingsComponent;
	let fixture: ComponentFixture<GithubSettingsComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it, for the template's real scope.
			imports: [IntegrationGithubUiModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(GithubSettingsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
