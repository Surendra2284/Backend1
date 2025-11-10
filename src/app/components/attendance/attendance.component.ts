import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  AttendanceService,
  Attendance,
  Student,
  AttStatus,
  Paginated
} from '../../services/attendance.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type SortKey = 'student' | 'className' | 'teacher' | 'username' | 'date' | 'status';

@Component({
  selector: 'app-attendance',
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.css'],
})
export class AttendanceComponent implements OnInit {
  attendanceForm: FormGroup;
  filterForm: FormGroup;

  students: Array<Student & { selected?: boolean }> = [];
  attendances: Attendance[] = [];

  // server pagination
  page = 1;
  pageSize = 10;
  totalCount = 0;

  // sorting (current page only)
  sortKey: SortKey = 'date';
  sortDir: 'asc' | 'desc' = 'desc';

  message = '';
  loading = false;

  constructor(private fb: FormBuilder, private attendanceService: AttendanceService) {
    this.attendanceForm = this.fb.group({
      className: ['', Validators.required],
      teacher: ['', Validators.required],
      username: ['', Validators.required],
      date: ['', Validators.required],
      status: ['Present', Validators.required], // Present | Absent | Leave
    });

    this.filterForm = this.fb.group({
      className: [''],
      name: [''],
      username: [''],
      studentId: [''],
      date: [''],
      status: [''],
    });
  }

  ngOnInit(): void {
    const today = new Date();
    const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    this.attendanceForm.patchValue({ date: iso });
    this.loadStudents();
    this.applyFilters();
  }

  // ---------------- Data loading ----------------
  loadStudents() {
    this.attendanceService.getStudents().subscribe({
      next: (data) => (this.students = (data || []).map((s) => ({ ...s, selected: false }))),
      error: () => this.msg('Failed to load students.'),
    });
  }

  applyFilters() {
    const f = this.filterForm.value;
    const query = {
      className: f.className || undefined,
      name: f.name || undefined,
      username: f.username || undefined,
      studentId: f.studentId || undefined,
      date: f.date || undefined,
      status: f.status || undefined,
      page: String(this.page),
      limit: String(this.pageSize),
    };

    this.loading = true;
    this.attendanceService.getAttendance(query).subscribe({
      next: (res: Paginated<Attendance>) => {
        this.loading = false;
        this.attendances = res?.data || [];
        this.totalCount = res?.total || 0;
      },
      error: () => {
        this.loading = false;
        this.msg('Failed to load attendance records.');
      },
    });
  }

  clearFilters() {
    this.filterForm.reset();
    this.page = 1;
    this.applyFilters();
  }

  // ---------------- Create (bulk) ----------------
  private normalizeStatus(val: any): AttStatus {
    const map: Record<string, AttStatus> = {
      present: 'Present',
      absent: 'Absent',
      leave: 'Leave',
    };
    return map[String(val || '').toLowerCase()] ?? 'Present';
  }

  saveAttendance() {
    this.message = '';
    if (this.attendanceForm.invalid) {
      this.attendanceForm.markAllAsTouched();
      this.msg('Please fill all required fields.');
      return;
    }

    const selectedIds = this.students
      .filter((s) => s.selected)
      .map((s) => (s as any)._id)
      .filter(Boolean);

    if (!selectedIds.length) {
      this.msg('Please select at least one student.');
      return;
    }

    const form = this.attendanceForm.value;
    const payload = {
      studentIds: selectedIds,
      className: form.className,
      teacher: form.teacher,
      username: form.username,
      date: form.date, // YYYY-MM-DD
      status: this.normalizeStatus(form.status),
    };

    this.loading = true;
    this.attendanceService.saveAttendanceBulk(payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.msg(`Attendance saved. Created: ${res.created ?? 0}, Updated: ${res.updated ?? 0}`);
        this.applyFilters();
        this.clearSelections();
      },
      error: () => {
        this.loading = false;
        this.msg('Failed to save attendance.');
      },
    });
  }

  clearSelections() {
    this.students = this.students.map((s) => ({ ...s, selected: false }));
  }

  // ---------------- Correct / Update / Delete ----------------
  /** Inline correction by student + date (uses /attendance/correct) */
  correctStatus(record: Attendance, newStatus: AttStatus, reason?: string) {
    const s: any = record?.student;
    const studentId =
      (s && (s._id || s.id || s.studentId)) || (typeof record.student === 'string' ? record.student : '');

    const date = this.formatDate(record.date); // ensure YYYY-MM-DD

    this.attendanceService
      .correctAttendance({
        studentId,
        date,
        newStatus: this.normalizeStatus(newStatus),
        reason,
        correctedBy: record.username, // or your current logged-in user
      })
      .subscribe({
        next: () => {
          this.msg('Attendance corrected successfully.');
          this.applyFilters();
        },
        error: () => this.msg('Failed to correct attendance.'),
      });
  }

  /** Patch by record _id (partial) */
  updateAttendance(id: string, patch: Partial<Attendance> & { reason?: string; correctedBy?: string }) {
    const payload: any = { ...patch };
    if (payload.status) payload.status = this.normalizeStatus(payload.status);
    if (payload.date) payload.date = this.formatDate(payload.date);

    this.attendanceService.patchAttendanceById(id, payload).subscribe({
      next: () => {
        this.msg('Attendance updated successfully.');
        this.applyFilters();
      },
      error: () => this.msg('Failed to update attendance.'),
    });
  }

  deleteAttendance(id: string) {
    this.attendanceService.deleteAttendance(id).subscribe({
      next: () => {
        this.msg('Attendance deleted successfully.');
        this.applyFilters();
      },
      error: () => this.msg('Failed to delete attendance.'),
    });
  }

  // ---------------- Sorting (current page) ----------------
  setSort(key: SortKey) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
  }

  private sortValue(r: Attendance, key: SortKey): any {
    if (key === 'student') return this.getStudentName(r) || '';
    if (key === 'date') return new Date(r.date).getTime() || 0;
    return (r as any)[key] ?? '';
  }

  get sorted(): Attendance[] {
    const data = [...this.attendances];
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return data.sort((a, b) => {
      const av = this.sortValue(a, this.sortKey);
      const bv = this.sortValue(b, this.sortKey);
      return av > bv ? dir : av < bv ? -dir : 0;
    });
  }

  // ---------------- Pagination helpers (server-driven) ----------------
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }
  prevPage() {
    if (this.page > 1) {
      this.page -= 1;
      this.applyFilters();
    }
  }
  nextPage() {
    if (this.page < this.totalPages) {
      this.page += 1;
      this.applyFilters();
    }
  }
  changePageSize(n: number) {
    this.pageSize = Math.max(1, Number(n) || 10);
    this.page = 1;
    this.applyFilters();
  }
  onPageSizeChange(v: number | string) {
    const n = Math.max(1, Number(v) || 10);
    this.changePageSize(n);
  }

  // ---------------- Summary / Dashboard ----------------
  get totals() {
    const total = this.attendances.length;
    const by: Record<AttStatus, number> = { Present: 0, Absent: 0, Leave: 0 };
    this.attendances.forEach((a) => {
      if (by[a.status as AttStatus] !== undefined) by[a.status as AttStatus]++;
    });
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    return {
      total,
      ...by,
      pctPresent: pct(by.Present),
      pctAbsent: pct(by.Absent),
      pctLeave: pct(by.Leave),
    };
  }

  // ---------------- Export ----------------
  exportExcel() {
    const rows = this.attendances.map((a) => ({
      Student: this.getStudentName(a),
      StudentId: this.getStudentId(a),
      Class: a.className,
      Teacher: a.teacher,
      Username: a.username,
      Date: this.formatDate(a.date),
      Status: a.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Attendance Report', 14, 16);

    const body = this.attendances.map((a) => [
      this.getStudentName(a),
      this.getStudentId(a),
      a.className,
      a.teacher,
      a.username,
      this.formatDate(a.date),
      a.status,
    ]);

    autoTable(doc, {
      head: [['Student', 'Student ID', 'Class', 'Teacher', 'Username', 'Date', 'Status']],
      body,
      startY: 22,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [240, 240, 240] },
    });

    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.text(
      `Total: ${this.totals.total} | Present: ${this.totals.Present} | Absent: ${this.totals.Absent} | Leave: ${this.totals.Leave}`,
      14,
      y
    );

    doc.save(`attendance_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ---------------- UI helpers / narrowers ----------------
  getStudentName(r: Attendance): string {
    const s: any = r?.student;
    return s && typeof s === 'object' ? (s.name ?? '') : '';
  }
  getStudentId(r: Attendance): string | number {
    const s: any = r?.student;
    return s && typeof s === 'object' ? (s.studentId ?? '') : '';
  }

  toggleSelectAll(ev: Event) {
    const checked = (ev.target as HTMLInputElement | null)?.checked ?? false;
    this.students = this.students.map((s) => ({ ...s, selected: checked }));
  }

  get allSelected(): boolean {
    return this.students.length > 0 && this.students.every((s) => !!s.selected);
  }

  trackByStudent = (_: number, s: any) => s?._id ?? s?.id ?? s?.studentId ?? _;
  trackByRecord = (_: number, r: any) => r?._id ?? _;

  // ---------------- Utils ----------------
  /** Safe date formatter -> YYYY-MM-DD */
  private formatDate(d: any): string {
    if (!d) return '';
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return String(d);
      return new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
    } catch {
      return String(d);
    }
  }

  private msg(m: string) {
    this.message = m;
  }
}
