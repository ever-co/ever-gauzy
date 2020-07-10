import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemsActionsComponent } from './items-actions.component';

describe('ItemsActionsComponent', () => {
	let component: ItemsActionsComponent;
	let fixture: ComponentFixture<ItemsActionsComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ItemsActionsComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ItemsActionsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
