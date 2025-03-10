import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { GalleryComponent } from './gallery.component';

describe('GalleryComponent', () => {
	let component: GalleryComponent;
	let fixture: ComponentFixture<GalleryComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [GalleryComponent],
			teardown: { destroyAfterEach: false }
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(GalleryComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
