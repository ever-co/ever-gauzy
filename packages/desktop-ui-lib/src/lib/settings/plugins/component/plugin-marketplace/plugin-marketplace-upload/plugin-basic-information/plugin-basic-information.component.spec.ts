import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PluginBasicInformationComponent } from './plugin-basic-information.component';

describe('PluginBasicInformationComponent', () => {
	let component: PluginBasicInformationComponent;
	let fixture: ComponentFixture<PluginBasicInformationComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PluginBasicInformationComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(PluginBasicInformationComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
