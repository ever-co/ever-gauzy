import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeafletMapComponent } from './leaflet.component';

describe('LeafletMapComponent', () => {
	let component: LeafletMapComponent;
	let fixture: ComponentFixture<LeafletMapComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [LeafletMapComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(LeafletMapComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
