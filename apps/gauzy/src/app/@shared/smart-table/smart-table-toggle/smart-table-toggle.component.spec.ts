import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmartTableToggleComponent } from './smart-table-toggle.component';

describe('SmartTableToggleComponent', () => {
	let component: SmartTableToggleComponent;
	let fixture: ComponentFixture<SmartTableToggleComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [SmartTableToggleComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(SmartTableToggleComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
