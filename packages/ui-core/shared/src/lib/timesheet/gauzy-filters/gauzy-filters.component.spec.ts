import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GauzyFiltersComponent } from './gauzy-filters.component';

describe('GauzyFiltersComponent', () => {
	let component: GauzyFiltersComponent;
	let fixture: ComponentFixture<GauzyFiltersComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [GauzyFiltersComponent]
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
