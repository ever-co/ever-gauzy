import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GauzyFiltersComponent } from './gauzy-filters.component';
import { GauzyFiltersModule } from './gauzy-filters.module';
describe('GauzyFiltersComponent', () => {
	let component: GauzyFiltersComponent;
	let fixture: ComponentFixture<GauzyFiltersComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			// Not standalone: import its NgModule. (This stub imported `GauzyRangePickerComponent`, a class the file
			// does not export, so it declared `undefined`.)
			imports: [GauzyFiltersModule]
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(GauzyFiltersComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
