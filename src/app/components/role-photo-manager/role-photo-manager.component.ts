import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { UserService } from '../../services/user.service';
const PhotoUrl = `${environment.apiUrl}/photos`;

type UserRole = 'Admin' | 'Teacher' | 'Student';

interface PhotoDto {
  _id: string;
  name: string;
  image: string;
  Role: UserRole | string;
  isApproved: boolean;
}

@Component({
  selector: 'app-role-photo-manager',
  templateUrl: './role-photo-manager.component.html',
  styleUrls: ['./role-photo-manager.component.css']
})
export class RolePhotoManagerComponent implements OnInit {

  // Assume you inject real role from AuthService
  currentUserRole: UserRole = 'Admin'; // set this from login context

  newPhotoName: string = '';
  newPhotoFile: File | null = null;
  newPhotoRole: UserRole | '' = '';

  updatePhotoId: string = '';
  updatePhotoName: string = '';
  updatePhotoFile: File | null = null;
  updatePhotoRole: UserRole | '' = '';
  updatePhotoApproved: boolean = false;
  role: string = '';
  username: string = '';
  photos: PhotoDto[] = [];
  Photoadd: string = '';
  api: string = PhotoUrl;
  successMessage: string = '';
  errorMessage: string = '';

  constructor(private userService: UserService,private http: HttpClient) {}

  ngOnInit() {
    this.loadPhotos();
    const userDetails = this.userService.getUserDetails();
    this.role = userDetails.role;
    this.username = userDetails.username;
    this.currentUserRole = this.role as UserRole;
  }

  // Handle file selection
  onFileSelect(event: Event, type: 'new' | 'update') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (type === 'new') {
      this.newPhotoFile = file;
    } else {
      this.updatePhotoFile = file;
    }
  }


  // Add a new photo with Role
  addPhoto(event: Event) {
    event.preventDefault();
    if (!this.newPhotoName || !this.newPhotoFile || !this.newPhotoRole) {
      this.errorMessage = 'Please provide name, role and file.';
      return;
    }

    const formData = new FormData();
    formData.append('name', this.newPhotoName);
    formData.append('image', this.newPhotoFile);
    formData.append('Role', this.newPhotoRole);

    this.Photoadd = `${environment.apiUrl}/photos/add`;
    this.http.post(this.Photoadd, formData).subscribe(
      (response: any) => {
        this.successMessage = response.message;
        this.errorMessage = '';
        this.newPhotoName = '';
        this.newPhotoFile = null;
        this.newPhotoRole = '';
        this.loadPhotos();
      },
      () => {
        this.successMessage = '';
        this.errorMessage = 'Error adding photo.';
      }
    );
  }

  // Load photos according to role
  loadPhotos() {
    let params = new HttpParams().set('role', this.currentUserRole);

    // Admin panel can see all photos for all roles
    if (this.currentUserRole === 'Admin') {
    // Admin sees everything (all roles, approved + pending)
    params = params.set('includeAll', 'true');
    // do NOT set role here
  } else {
    // Teacher / Student – only their role, only approved
    params = params.set('role', this.currentUserRole);
    // includeAll not set -> backend filters isApproved=true
  }


    this.http.get<PhotoDto[]>(PhotoUrl, { params }).subscribe(
      (response) => {
        this.photos = response;
        this.errorMessage = '';
      },
      () => {
        this.errorMessage = 'Error fetching photos.';
      }
    );
  }

  // Pre-fill update form when admin selects a photo
  selectPhotoForEdit(photo: PhotoDto) {
    if (this.currentUserRole !== 'Admin') return;
    this.updatePhotoId = photo._id;
    this.updatePhotoName = photo.name;
    this.updatePhotoRole = photo.Role as UserRole;
    this.updatePhotoApproved = photo.isApproved;
    this.updatePhotoFile = null;
  }

  // Update existing photo (Admin only)
  updatePhoto(event: Event) {
    event.preventDefault();
    if (!this.updatePhotoId) {
      this.errorMessage = 'Please select a photo to update.';
      return;
    }

    const formData = new FormData();
    if (this.updatePhotoName) formData.append('name', this.updatePhotoName);
    if (this.updatePhotoRole) formData.append('Role', this.updatePhotoRole);
    formData.append('isApproved', String(this.updatePhotoApproved));
    if (this.updatePhotoFile) {
      formData.append('image', this.updatePhotoFile);
    }

    this.Photoadd = `${environment.apiUrl}/photos/update/${this.updatePhotoId}`;
    this.http.put(this.Photoadd, formData).subscribe(
      (response: any) => {
        this.successMessage = response.message;
        this.errorMessage = '';
        this.updatePhotoId = '';
        this.updatePhotoName = '';
        this.updatePhotoRole = '';
        this.updatePhotoApproved = false;
        this.updatePhotoFile = null;
        this.loadPhotos();
      },
      () => {
        this.successMessage = '';
        this.errorMessage = 'Error updating photo.';
      }
    );
  }

  // Quick toggle approval (Admin)
  toggleApproval(photo: PhotoDto) {
    if (this.currentUserRole !== 'Admin') return;

    const formData = new FormData();
    formData.append('isApproved', String(!photo.isApproved));

    this.Photoadd = `${environment.apiUrl}/photos/update/${photo._id}`;
    this.http.put(this.Photoadd, formData).subscribe(
      (response: any) => {
        this.successMessage = response.message;
        this.errorMessage = '';
        this.loadPhotos();
      },
      () => {
        this.successMessage = '';
        this.errorMessage = 'Error updating approval.';
      }
    );
  }

  // Delete a photo (Admin only)
  deletePhoto(photoId: string) {
    if (this.currentUserRole !== 'Admin') return;

    this.Photoadd = `${environment.apiUrl}/photos/delete/${photoId}`;
    this.http.delete(this.Photoadd).subscribe(
      (response: any) => {
        this.successMessage = response.message;
        this.errorMessage = '';
        this.loadPhotos();
      },
      () => {
        this.successMessage = '';
        this.errorMessage = 'Error deleting photo.';
      }
    );
  }
}
