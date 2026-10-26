import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntegrationAIAuthorizationComponent } from './authorization.component';
import { IntegrationAiUiModule } from '../../integration-ai-ui.module';
import { PipesModule } from '@gauzy/ui-core/shared';
describe('IntegrationAIAuthorizationComponent', () => {
	let component: IntegrationAIAuthorizationComponent;
	let fixture: ComponentFixture<IntegrationAIAuthorizationComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it. PipesModule provides the pipes it injects
			// (the app gets them from its root imports).
			imports: [IntegrationAiUiModule, PipesModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(IntegrationAIAuthorizationComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
