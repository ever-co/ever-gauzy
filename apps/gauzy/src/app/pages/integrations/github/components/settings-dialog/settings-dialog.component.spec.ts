import { waitForAsync, ComponentFixture, TestBed } from '@angular/core/testing';

import { GithubSettingsDialogComponent } from './settings-dialog.component';

describe('GithubSettingsDialogComponent', () => {
	let component: GithubSettingsDialogComponent;
	let fixture: ComponentFixture<GithubSettingsDialogComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [GithubSettingsDialogComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GithubSettingsDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
