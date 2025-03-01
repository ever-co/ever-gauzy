import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PluginMarketplaceDetailComponent } from './plugin-marketplace-detail.component';

describe('PluginMarktplaceDetailComponent', () => {
	let component: PluginMarketplaceDetailComponent;
	let fixture: ComponentFixture<PluginMarketplaceDetailComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [PluginMarketplaceDetailComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(PluginMarketplaceDetailComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
