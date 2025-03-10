import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { SyncDataSelectionComponent } from './sync-data-selection.component';

describe('SyncDataSelectionComponent', () => {
	let component: SyncDataSelectionComponent;
	let fixture: ComponentFixture<SyncDataSelectionComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [SyncDataSelectionComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(SyncDataSelectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
