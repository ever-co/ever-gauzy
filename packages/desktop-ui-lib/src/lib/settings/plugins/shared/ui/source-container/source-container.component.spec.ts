import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SourceContainerComponent } from './source-container.component';
import { FormArray } from '@angular/forms';
describe('SourceContainerComponent', () => {
	let component: SourceContainerComponent;
	let fixture: ComponentFixture<SourceContainerComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SourceContainerComponent]
		}).compileComponents();
		fixture = TestBed.createComponent(SourceContainerComponent);
		component = fixture.componentInstance;
		// The parent form passes its `sources` FormArray in; the template iterates its controls.
		component.sources = new FormArray([]);
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
