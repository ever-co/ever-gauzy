import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntegrationAIViewComponent } from './view.component';
import { IntegrationAiUiModule } from '../../integration-ai-ui.module';
import { PipesModule } from '@gauzy/ui-core/shared';
describe('IntegrationAIViewComponent', () => {
	let component: IntegrationAIViewComponent;
	let fixture: ComponentFixture<IntegrationAIViewComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import the plugin NgModule that declares it. PipesModule provides the pipes it injects
			// (the app gets them from its root imports).
			imports: [IntegrationAiUiModule, PipesModule],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(IntegrationAIViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
