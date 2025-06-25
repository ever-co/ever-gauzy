import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CamshotListComponent } from './camshot-list.component';

describe('CamshotListComponent', () => {
	let component: CamshotListComponent;
	let fixture: ComponentFixture<CamshotListComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [CamshotListComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(CamshotListComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
