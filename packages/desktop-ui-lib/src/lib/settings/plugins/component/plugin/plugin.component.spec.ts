import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PluginComponent } from './plugin.component';

describe('PluginComponent', () => {
	let component: PluginComponent;
	let fixture: ComponentFixture<PluginComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PluginComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(PluginComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
