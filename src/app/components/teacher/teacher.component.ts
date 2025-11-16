import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

import { TeacherService } from '../../services/teacher.service';
import { Teacher } from '../models/Teacher';
import { AuthService } from '../../shared/auth-service';
import { Router } from '@angular/router';

type SortKey = 'name' | 'subject' | 'Assignclass' | 'Email';

@Component({
  selector: 'app-teacher',
  templateUrl: './teacher.component.html',
  styleUrls: ['./teacher.component.css'],
})
export class TeacherComponent implements OnInit, OnDestroy {
  // ---- Form / data ----
  teacherForm: FormGroup;
  teachers: Teacher[] = [];

  isEdit = false;
  currentTeacherId: string | null = null;

  // ---- Auth ----
  userAuthenticated = false;
  private authenticatedSub?: Subscription;

  // ---- Toast ----
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  // ---- UI state ----
  loading = false;
  errorMessage = '';
  viewMode: 'grid' | 'table' = 'table';

  // search + sorting + pagination (client-side)
  query = '';
  sortKey: SortKey = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 8;

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

  // ---------- Lifecycle ----------
  ngOnInit(): void {
    this.checkAuthentication();
    this.loadTeachers();
  }

  ngOnDestroy(): void {
    this.authenticatedSub?.unsubscribe();
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

  // ---------- Toast ----------
  private showToastMessage(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => (this.showToast = false), 2500);
  }

  // ---------- Data ----------
  loadTeachers(): void {
    this.loading = true;
    this.teacherService.getTeachers().subscribe({
      next: (data) => {
        this.loading = false;
        this.teachers = data || [];
        // reset pager if needed
        this.page = 1;
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.message || 'Failed to load teachers';
      },
    });
  }

  // ---------- Submit (Add / Edit) ----------
  onSubmit(): void {
    if (this.teacherForm.invalid) {
      this.teacherForm.markAllAsTouched();
      this.showToastMessage('⚠️ Please fill all required fields correctly.', 'error');
      return;
    }

    const teacherData: Teacher = this.teacherForm.value;

    if (this.isEdit && this.currentTeacherId) {
      this.loading = true;
      this.teacherService.editTeacher(this.currentTeacherId, teacherData).subscribe({
        next: () => {
          this.loading = false;
          this.loadTeachers();
          this.resetForm();
          this.showToastMessage('✅ Teacher updated successfully!');
        },
        error: (error) => {
          this.loading = false;
          console.error('Error updating teacher:', error);
          this.showToastMessage('❌ Error updating teacher.', 'error');
        },
      });
    } else {
      this.loading = true;
      this.teacherService.addTeacher(teacherData).subscribe({
        next: () => {
          this.loading = false;
          this.loadTeachers();
          this.resetForm();
          this.showToastMessage('✅ Teacher added successfully!');
        },
        error: (error) => {
          this.loading = false;
          console.error('Error adding teacher:', error);
          this.showToastMessage('❌ Error adding teacher.', 'error');
        },
      });
    }
  }

  // ---------- Row Actions ----------
  editTeacher(teacher: Teacher): void {
    this.isEdit = true;
    const idForEdit = (teacher as any)._id ?? teacher.teacherid;
    this.currentTeacherId = idForEdit ? String(idForEdit) : null;

    const photoVal = teacher.photo
      ? (String(teacher.photo).startsWith('data:image') ? teacher.photo : `data:image/jpeg;base64,${teacher.photo}`)
      : null;

    this.teacherForm.patchValue({
      teacherid: teacher.teacherid ?? (teacher as any)._id ?? '',
      name: teacher.name ?? '',
      Assignclass: teacher.Assignclass ?? '',
      mobileNo: teacher.mobileNo ?? '',
      address: teacher.address ?? '',
      Role: teacher.Role ?? '',
      Notice: teacher.Notice ?? '',
      Email: teacher.Email ?? '',
      subject: teacher.subject ?? '',
      attendance: teacher.attendance ?? 0,
      photo: photoVal,
      classteacher: teacher.classteacher ?? '',
      experience: teacher.experience ?? 0,
    });

    // Scroll to form for visibility
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteTeacher(teacher: Teacher): void {
    const idForDelete = (teacher as any)._id ?? teacher.teacherid;
    if (!idForDelete) {
      this.showToastMessage('❌ Missing teacher id.', 'error');
      return;
    }
    if (!confirm('Are you sure you want to delete this teacher?')) return;

    this.loading = true;
    this.teacherService.deleteTeacher(String(idForDelete)).subscribe({
      next: () => {
        this.loading = false;
        this.loadTeachers();
        this.showToastMessage('🗑️ Teacher deleted successfully!');
      },
      error: (error) => {
        this.loading = false;
        console.error('Error deleting teacher:', error);
        this.showToastMessage('❌ Error deleting teacher.', 'error');
      },
    });
  }

  // ---------- Helpers ----------
  resetForm(): void {
    this.teacherForm.reset();
    this.isEdit = false;
    this.currentTeacherId = null;
  }

  onPhotoUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    const maxSize = 0.5 * 1024 * 1024; // 0.5 MB
    if (!file) return;

    if (file.size > maxSize) {
      this.showToastMessage('⚠️ File too large (max 0.5 MB)', 'error');
      this.teacherForm.get('photo')?.setErrors({ maxSizeExceeded: true });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.teacherForm.patchValue({ photo: reader.result }); // data URL
    };
    reader.readAsDataURL(file);
  }

  formatPhoto(photo: any): string {
    if (!photo) return 'assets/default-user.png';
    const s = String(photo);
    if (s.startsWith('data:image')) return s;
    return 'data:image/jpeg;base64,' + s;
  }

  // ---------- List UX helpers (search/sort/paginate) ----------
  get filtered(): Teacher[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.teachers;
    return this.teachers.filter((t) => {
      const hay = [
        t.name,
        t.subject,
        t.Assignclass,
        t.Email,
        t.mobileNo,
        t.classteacher,
        t.teacherid
      ].map(v => (v == null ? '' : String(v).toLowerCase()));
      return hay.some(x => x.includes(q));
    });
  }

  get sorted(): Teacher[] {
    const arr = [...this.filtered];
    const key = this.sortKey;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return arr.sort((a: any, b: any) => {
      const av = (a?.[key] ?? '').toString().toLowerCase();
      const bv = (b?.[key] ?? '').toString().toLowerCase();
      return av > bv ? dir : av < bv ? -dir : 0;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sorted.length / this.pageSize));
  }

  get paged(): Teacher[] {
    const start = (this.page - 1) * this.pageSize;
    return this.sorted.slice(start, start + this.pageSize);
  }

  changeSort(k: SortKey) {
    if (this.sortKey === k) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = k;
      this.sortDir = 'asc';
    }
  }

  setView(mode: 'grid' | 'table') { this.viewMode = mode; }
  setPageSize(n: number) { this.pageSize = Math.max(1, Number(n) || 8); this.page = 1; }
  prevPage() { this.page = Math.max(1, this.page - 1); }
  nextPage() { this.page = Math.min(this.totalPages, this.page + 1); }

  trackById = (_: number, t: any) => t?._id ?? t?.teacherid ?? _;
}
