import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CurrencyComponent } from './currency.component';

describe('CurrencyComponent', () => {
	let component: CurrencyComponent;
	let fixture: ComponentFixture<CurrencyComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [CurrencyComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(CurrencyComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
