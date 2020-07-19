import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UpworkAuthorizeComponent } from './upwork-authorize.component';

describe('UpworkAuthorizeComponent', () => {
	let component: UpworkAuthorizeComponent;
	let fixture: ComponentFixture<UpworkAuthorizeComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [UpworkAuthorizeComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(UpworkAuthorizeComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
