import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PluginStatusComponent } from './plugin-status.component';

describe('PluginStatusComponent', () => {
	let component: PluginStatusComponent;
	let fixture: ComponentFixture<PluginStatusComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [PluginStatusComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(PluginStatusComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
