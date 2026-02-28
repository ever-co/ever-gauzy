import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductTypesComponent } from './product-types.component';
describe('ProductTypeComponent', () => {
	let component: ProductTypesComponent;
	let fixture: ComponentFixture<ProductTypesComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ProductTypesComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	});
	beforeEach(() => {
		fixture = TestBed.createComponent(ProductTypesComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
