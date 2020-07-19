import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewTimeLogComponent } from './view-time-log.component';

describe('ViewTimeLogComponent', () => {
	let component: ViewTimeLogComponent;
	let fixture: ComponentFixture<ViewTimeLogComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ViewTimeLogComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ViewTimeLogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
