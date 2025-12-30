import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RolePhotoManagerComponent } from './role-photo-manager.component';

describe('RolePhotoManagerComponent', () => {
  let component: RolePhotoManagerComponent;
  let fixture: ComponentFixture<RolePhotoManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RolePhotoManagerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RolePhotoManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
