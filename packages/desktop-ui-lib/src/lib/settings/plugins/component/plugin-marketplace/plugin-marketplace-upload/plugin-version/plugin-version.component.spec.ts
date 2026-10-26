import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PluginVersionComponent } from './plugin-version.component';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
describe('PluginVersionComponent', () => {
	let component: PluginVersionComponent;
	let fixture: ComponentFixture<PluginVersionComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PluginVersionComponent]
		}).compileComponents();
		fixture = TestBed.createComponent(PluginVersionComponent);
		component = fixture.componentInstance;
		// A section of the upload form: the parent passes its version FormGroup in (see plugin-marketplace-upload).
		component.form = new FormGroup({
			number: new FormControl(''),
			changelog: new FormControl(''),
			releaseDate: new FormControl(new Date('2026-01-05T00:00:00.000Z')),
			sources: new FormArray([])
		});
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
