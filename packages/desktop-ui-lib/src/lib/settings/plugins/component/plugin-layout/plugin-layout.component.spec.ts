import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PluginLayoutComponent } from './plugin-layout.component';

describe('PluginLayoutComponent', () => {
	let component: PluginLayoutComponent;
	let fixture: ComponentFixture<PluginLayoutComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [PluginLayoutComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(PluginLayoutComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
