import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { StudentService } from '../../services/student.service';
import { TeacherService } from '../../services/teacher.service';
import { Teacher } from '../models/Teacher';
import { AuthService } from '../../shared/auth-service';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';


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

  // ---- Class list (for Assignclass select) ----
  classes: string[] = [];
  loadingClasses = false;

  // ---- Toast ----
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  // ---- UI state ----
  loading = false;
  errorMessage = '';
  viewMode: 'grid' | 'table' = 'grid';

  // search + sorting + pagination (client-side)
  query = '';
  sortKey: SortKey = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 8;

  constructor(
    private fb: FormBuilder,
    private teacherService: TeacherService,
    private studentService: StudentService,
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
    this.loadClasses();
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

  // ---------- Auto teacherid helper ----------
  private generateNextTeacherIdFromList(list: Teacher[]): string {
    if (!list || !list.length) {
      return 'T001';
    }

    const nums = list
      .map(t => String(t.teacherid || ''))
      .map(id => {
        const m = id.match(/T(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter(n => !isNaN(n));

    const max = nums.length ? Math.max(...nums) : 0;
    const next = max + 1;

    return 'T' + String(next).padStart(3, '0');  // T001, T002, ...
  }

  private setNextTeacherIdIfNew(): void {
    if (this.isEdit) return;
    const nextId = this.generateNextTeacherIdFromList(this.teachers);
    this.teacherForm.patchValue({ teacherid: nextId });
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
        this.page = 1;

        // auto-fill next ID for new entry
        this.setNextTeacherIdIfNew();
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
    // assign next teacherid after reset
    this.setNextTeacherIdIfNew();
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

  loadClasses(): void {
    this.loadingClasses = true;
    this.studentService.getAllClasses().subscribe({
      next: (list) => {
        this.loadingClasses = false;
        this.classes = (list || []).filter(Boolean);
      },
      error: (err) => {
        this.loadingClasses = false;
        console.error('Error loading classes', err);
      }
    });
  }

  setView(mode: 'grid' | 'table') { this.viewMode = mode; }
  setPageSize(n: number) { this.pageSize = Math.max(1, Number(n) || 8); this.page = 1; }
  prevPage() { this.page = Math.max(1, this.page - 1); }
  nextPage() { this.page = Math.min(this.totalPages, this.page + 1); }

  trackById = (_: number, t: any) => t?._id ?? t?.teacherid ?? _;
  
  exportToExcel(): void {
  if (!this.sorted.length) {
    this.showToastMessage('⚠️ No data to export', 'error');
    return;
  }

  console.log('Exporting teachers to Excel...', this.sorted);

  // IMPORTANT: DO NOT include photo / base64 fields
  const exportData = this.sorted.map((t, index) => ({
    'S.No': index + 1,
    'Teacher ID': t.teacherid || '',
    'Name': t.name || '',
    'Email': t.Email || '',
    'Mobile': t.mobileNo || '',
    'Subject': t.subject || '',
    'Assigned Class': t.Assignclass || '',
    'Class Teacher': t.classteacher || '',
    'Experience (Years)': t.experience ?? '',
    'Attendance %': t.attendance ?? '',
    'Notice': (t.Notice || '').substring(0, 200) // safety limit
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Optional: auto column width
  worksheet['!cols'] = Object.keys(exportData[0]).map(() => ({ wch: 22 }));

  const workbook: XLSX.WorkBook = {
    Sheets: { Teachers: worksheet },
    SheetNames: ['Teachers']
  };

  XLSX.writeFile(
    workbook,
    `Teacher_List_${new Date().toISOString().slice(0, 10)}.xlsx`
  );

  this.showToastMessage('📤 Teacher list exported successfully');
}

 
   downloadTemplate() {
     const sample = [
       { Username: "john", Password: "12345", Role: "Teacher" }
     ];
     const ws = XLSX.utils.json_to_sheet(sample);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Template");
     XLSX.writeFile(wb, "teacher_template.xlsx");
   }
}
