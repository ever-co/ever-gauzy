import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogCreateSourceComponent } from './dialog-create-source.component';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { PluginSourceComponent } from '../../plugin-marketplace-upload/plugin-source/plugin-source.component';
import { CdnFormComponent } from '../../plugin-marketplace-upload/plugin-source/forms/cdn-form/cdn-form.component';
import { NpmFormComponent } from '../../plugin-marketplace-upload/plugin-source/forms/npm-form/npm-form.component';
describe('DialogCreateSourceComponent', () => {
	let component: DialogCreateSourceComponent;
	let fixture: ComponentFixture<DialogCreateSourceComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DialogCreateSourceComponent]
		})
			// The plugin source forms use `<nb-hint>` as a plain element styled by their .scss; Nebular has no
			// such component, so the app renders it as an unknown element. Tell the test env it is intended.
			.overrideComponent(PluginSourceComponent, { add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] } })
			.overrideComponent(CdnFormComponent, { add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] } })
			.overrideComponent(NpmFormComponent, { add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] } })
			.compileComponents();
		fixture = TestBed.createComponent(DialogCreateSourceComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
