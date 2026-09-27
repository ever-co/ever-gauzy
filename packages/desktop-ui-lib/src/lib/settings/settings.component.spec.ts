import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { environment } from '@gauzy/ui-config';
import { GAUZY_ENV } from '../constants';
import { FormsModule } from '@angular/forms';
import { LanguageSelectorComponent } from '../language/language-selector.component';
describe('SettingsComponent', () => {
	let component: SettingsComponent;
	let fixture: ComponentFixture<SettingsComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SettingsComponent],
			// The desktop apps provide this library's GAUZY_ENV token as the web environment plus their own
			// flags (apps/desktop/src/main.ts). The web environment is enough for a render.
			providers: [{ provide: GAUZY_ENV, useValue: environment }]
		})
			// LanguageSelectorComponent (rendered inside settings) binds `[(ngModel)]` on its nb-select but does
			// not import FormsModule, so the zone test env rejects the template. The binding is dead in the app
			// too (`[(selected)]` next to it does the work); giving the child FormsModule here keeps this spec
			// about SettingsComponent. Tracked as a separate template fix.
			.overrideComponent(LanguageSelectorComponent, { add: { imports: [FormsModule] } })
			.compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(SettingsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
