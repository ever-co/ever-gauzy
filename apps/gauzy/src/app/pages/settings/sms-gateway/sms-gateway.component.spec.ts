import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmsGatewayComponent } from './sms-gateway.component';

describe('SmsGatewayComponent', () => {
	let component: SmsGatewayComponent;
	let fixture: ComponentFixture<SmsGatewayComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [SmsGatewayComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(SmsGatewayComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
