import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AmountsOwedGridComponent } from './amounts-owed-grid.component';

describe('AmountsOwedGridComponent', () => {
	let component: AmountsOwedGridComponent;
	let fixture: ComponentFixture<AmountsOwedGridComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [AmountsOwedGridComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(AmountsOwedGridComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
