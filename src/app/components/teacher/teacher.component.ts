import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TeacherService } from '../../services/teacher.service';
import { Teacher } from '../models/Teacher';
import { AuthService } from '../../shared/auth-service';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

const TeacherUrl = `${environment.apiUrl}/teachers`;

@Component({
  selector: 'app-teacher',
  templateUrl: './teacher.component.html',
  styleUrls: ['./teacher.component.css'],
})
export class TeacherComponent implements OnInit, OnDestroy {
  teacherForm: FormGroup;
  teachers: Teacher[] = [];
  isEdit = false;
  errorMessage = '';
  currentTeacherId: string | null = null;
  userAuthenticated = false;
  authenticatedSub: Subscription = new Subscription();

  // ✅ Toast variables
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  constructor(
    private fb: FormBuilder,
    private teacherService: TeacherService,
    private authService: AuthService,
    private router: Router
  ) {
    this.teacherForm = this.fb.group({
      teacherid: ['', Validators.required],
      name: ['', [Validators.required, Validators.minLength(2)]],
      Assignclass: ['', Validators.required],
      mobileNo: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      Role: ['', Validators.required],
      Notice: [''],
      Email: ['', [Validators.required, Validators.email]],
      subject: ['', Validators.required],
      attendance: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      photo: [null, Validators.required],
      classteacher: ['', Validators.required],
      experience: [0, [Validators.required, Validators.min(0)]],
    });
  }

  ngOnInit(): void {
    this.checkAuthentication();
    this.teacherService.getTeachers().subscribe({
      next: (res) => (this.teachers = res),
      error: (err) => console.error('Error fetching teachers:', err),
    });
  }

  ngOnDestroy(): void {
    this.authenticatedSub.unsubscribe();
  }

  private checkAuthentication(): void {
    this.userAuthenticated = this.authService.getIsAuthenticated();
    this.authenticatedSub = this.authService.getAuthenticatedSub().subscribe((status) => {
      this.userAuthenticated = status;
      if (!this.userAuthenticated) {
        alert('You are not logged in! Redirecting to login page...');
        this.router.navigate(['header']);
      }
    });
  }

  /** ✅ Toast helper */
  private showToastMessage(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => (this.showToast = false), 3000);
  }

  loadTeachers(): void {
    this.teacherService.getTeachers().subscribe({
      next: (data) => (this.teachers = data),
      error: (error) => (this.errorMessage = error.message),
    });
  }

  onSubmit(): void {
    if (this.teacherForm.invalid) {
      this.showToastMessage('⚠️ Please fill all required fields correctly.', 'error');
      this.teacherForm.markAllAsTouched();
      return;
    }

    const teacherData: Teacher = this.teacherForm.value;

    if (this.isEdit && this.currentTeacherId) {
      this.teacherService.editTeacher(this.currentTeacherId, teacherData).subscribe({
        next: () => {
          this.loadTeachers();
          this.resetForm();
          this.showToastMessage('✅ Teacher updated successfully!');
        },
        error: (error) => {
          console.error('Error updating teacher:', error);
          this.showToastMessage('❌ Error updating teacher.', 'error');
        },
      });
    } else {
      this.teacherService.addTeacher(teacherData).subscribe({
        next: () => {
          this.loadTeachers();
          this.resetForm();
          this.showToastMessage('✅ Teacher added successfully!');
        },
        error: (error) => {
          console.error('Error adding teacher:', error);
          this.showToastMessage('❌ Error adding teacher.', 'error');
        },
      });
    }
  }

  editTeacher(teacher: Teacher): void {
    this.isEdit = true;
    this.currentTeacherId = teacher.teacherid;
    this.teacherForm.patchValue(teacher);
  }

  deleteTeacher(teacher: Teacher): void {
    if (!teacher.teacherid) return;

    if (confirm('Are you sure you want to delete this teacher?')) {
      this.teacherService.deleteTeacher(teacher.teacherid).subscribe({
        next: () => {
          this.loadTeachers();
          this.showToastMessage('🗑️ Teacher deleted successfully!');
        },
        error: (error) => {
          console.error('Error deleting teacher:', error);
          this.showToastMessage('❌ Error deleting teacher.', 'error');
        },
      });
    }
  }

  resetForm(): void {
    this.teacherForm.reset();
    this.isEdit = false;
    this.currentTeacherId = null;
  }

  onPhotoUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    const maxSize = 0.5 * 1024 * 1024;

    if (file) {
      if (file.size > maxSize) {
        this.showToastMessage('⚠️ File too large (max 0.5 MB)', 'error');
        this.teacherForm.get('photo')?.setErrors({ maxSizeExceeded: true });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.teacherForm.patchValue({ photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  }
}
