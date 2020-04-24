import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsDialogComponent } from './settings-dialog.component';

describe('SettingsDialogComponent', () => {
	let component: SettingsDialogComponent;
	let fixture: ComponentFixture<SettingsDialogComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [SettingsDialogComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(SettingsDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
