import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalsComponent } from './proposals.component';

describe('ProposalsComponent', () => {
	let component: ProposalsComponent;
	let fixture: ComponentFixture<ProposalsComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ProposalsComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ProposalsComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
