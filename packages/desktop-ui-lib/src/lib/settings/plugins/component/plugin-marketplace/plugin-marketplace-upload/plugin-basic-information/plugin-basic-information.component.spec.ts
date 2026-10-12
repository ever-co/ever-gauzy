import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PluginBasicInformationComponent } from './plugin-basic-information.component';
import { FormControl, FormGroup } from '@angular/forms';
describe('PluginBasicInformationComponent', () => {
	let component: PluginBasicInformationComponent;
	let fixture: ComponentFixture<PluginBasicInformationComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PluginBasicInformationComponent]
		}).compileComponents();
		fixture = TestBed.createComponent(PluginBasicInformationComponent);
		component = fixture.componentInstance;
		// A section of the upload form: the parent passes its FormGroup in (see plugin-marketplace-upload).
		component.form = new FormGroup({
			name: new FormControl(''),
			description: new FormControl(''),
			type: new FormControl(null),
			status: new FormControl(null),
			categoryId: new FormControl(null)
		});
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
