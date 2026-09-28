import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PluginMetadataComponent } from './plugin-metadata.component';
import { FormControl, FormGroup } from '@angular/forms';
describe('PluginMetadataComponent', () => {
	let component: PluginMetadataComponent;
	let fixture: ComponentFixture<PluginMetadataComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PluginMetadataComponent]
		}).compileComponents();
		fixture = TestBed.createComponent(PluginMetadataComponent);
		component = fixture.componentInstance;
		// A section of the upload form: the parent passes its FormGroup in (see plugin-marketplace-upload).
		component.form = new FormGroup({
			author: new FormControl(''),
			license: new FormControl(''),
			homepage: new FormControl(''),
			repository: new FormControl('')
		});
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
