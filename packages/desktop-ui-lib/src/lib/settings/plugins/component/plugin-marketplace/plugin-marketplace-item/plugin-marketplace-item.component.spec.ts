import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PluginMarketplaceItemComponent } from './plugin-marketplace-item.component';

describe('PluginMarketplaceItemComponent', () => {
  let component: PluginMarketplaceItemComponent;
  let fixture: ComponentFixture<PluginMarketplaceItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PluginMarketplaceItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PluginMarketplaceItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
