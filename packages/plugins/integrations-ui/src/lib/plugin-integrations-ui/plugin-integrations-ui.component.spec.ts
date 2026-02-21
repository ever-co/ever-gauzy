import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PluginIntegrationsUiComponent } from './plugin-integrations-ui.component';

describe('PluginIntegrationsUiComponent', () => {
	let component: PluginIntegrationsUiComponent;
	let fixture: ComponentFixture<PluginIntegrationsUiComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PluginIntegrationsUiComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(PluginIntegrationsUiComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
