import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AutoRefeshComponent } from './auto-refesh.component';

describe('AutoRefeshComponent', () => {
	let component: AutoRefeshComponent;
	let fixture: ComponentFixture<AutoRefeshComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AutoRefeshComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(AutoRefeshComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
