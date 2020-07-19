import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SyncDataSelectionComponent } from './sync-data-selection.component';

describe('SyncDataSelectionComponent', () => {
	let component: SyncDataSelectionComponent;
	let fixture: ComponentFixture<SyncDataSelectionComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [SyncDataSelectionComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(SyncDataSelectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
