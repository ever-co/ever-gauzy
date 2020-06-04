import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductTypesComponent } from './product-types.component';

describe('ProductTypeComponent', () => {
	let component: ProductTypesComponent;
	let fixture: ComponentFixture<ProductTypesComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ProductTypesComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ProductTypesComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
