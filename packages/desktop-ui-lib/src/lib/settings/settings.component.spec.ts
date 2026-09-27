import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { environment } from '@gauzy/ui-config';
import { GAUZY_ENV } from '../constants';
describe('SettingsComponent', () => {
	let component: SettingsComponent;
	let fixture: ComponentFixture<SettingsComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SettingsComponent],
			// The desktop apps provide this library's GAUZY_ENV token as the web environment plus their own
			// flags (apps/desktop/src/main.ts). The web environment is enough for a render.
			providers: [{ provide: GAUZY_ENV, useValue: environment }]
		}).compileComponents();
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
