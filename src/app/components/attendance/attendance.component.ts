import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AttendanceService, Attendance, Student, AttStatus } from '../../services/attendance.service';
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

  // pagination + sorting
  page = 1;
  pageSize = 10;
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
      status: ['Present', Validators.required],
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
    const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    this.attendanceForm.patchValue({ date: iso });

    this.loadStudents();
    this.applyFilters();
  }

  // --- Data loading
  loadStudents() {
    this.attendanceService.getStudents().subscribe({
      next: (data) => this.students = (data || []).map(s => ({ ...s, selected: false })),
      error: () => this.msg('Failed to load students.')
    });
  }

  applyFilters() {
    const f = this.filterForm.value;
    this.attendanceService.getAttendance({
      className: f.className || undefined,
      name: f.name || undefined,
      username: f.username || undefined,
      studentId: f.studentId || undefined,
      date: f.date || undefined,
      status: f.status || undefined,
    }).subscribe({
      next: (data) => {
        this.attendances = data || [];
        this.page = 1; // reset to first page
      },
      error: () => this.msg('Failed to load attendance records.')
    });
  }

  clearFilters() {
    this.filterForm.reset();
    this.applyFilters();
  }

  // --- Create (bulk)
  private normalizeStatus(val: any): AttStatus {
    const map: Record<string, AttStatus> = { present: 'Present', absent: 'Absent', late: 'Late' };
    return map[String(val || '').toLowerCase()] ?? 'Present';
  }

  saveAttendance() {
    this.message = '';
    if (this.attendanceForm.invalid) {
      this.attendanceForm.markAllAsTouched();
      this.msg('Please fill all required fields.');
      return;
    }

    const selectedIds = this.students.filter(s => s.selected).map(s => (s as any)._id).filter(Boolean);
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
      date: form.date,
      status: this.normalizeStatus(form.status),
    };

    this.loading = true;
    this.attendanceService.saveAttendanceBulk(payload).subscribe({
      next: () => { this.loading = false; this.msg('Attendance saved successfully.'); this.applyFilters(); this.clearSelections(); },
      error: () => { this.loading = false; this.msg('Failed to save attendance.'); }
    });
  }

  clearSelections() {
    this.students = this.students.map(s => ({ ...s, selected: false }));
  }

  // --- Update / Delete
  updateAttendance(id: string, patch: Partial<Attendance>) {
    const payload: any = { ...patch };
    if (payload.status) payload.status = this.normalizeStatus(payload.status);
    this.attendanceService.updateAttendance(id, payload).subscribe({
      next: () => { this.msg('Attendance updated successfully.'); this.applyFilters(); },
      error: () => this.msg('Failed to update attendance.')
    });
  }

  deleteAttendance(id: string) {
    this.attendanceService.deleteAttendance(id).subscribe({
      next: () => { this.msg('Attendance deleted successfully.'); this.applyFilters(); },
      error: () => this.msg('Failed to delete attendance.')
    });
  }

  // --- Sorting & Paging
  setSort(key: SortKey) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
  }

  get sorted(): Attendance[] {
    const data = [...this.attendances];
    const dir = this.sortDir === 'asc' ? 1 : -1;

    const val = (r: Attendance, key: SortKey) => {
      if (key === 'student') return r.student?.name || '';
      return (r as any)[key] ?? '';
    };

    return data.sort((a, b) => {
      const av = val(a, this.sortKey);
      const bv = val(b, this.sortKey);
      return av > bv ? dir : av < bv ? -dir : 0;
    });
  }

  get paged(): Attendance[] {
    const start = (this.page - 1) * this.pageSize;
    return this.sorted.slice(start, start + this.pageSize);
  }

  // --- Summary / Dashboard
  get totals() {
    const total = this.attendances.length;
    const by: Record<AttStatus, number> = { Present: 0, Absent: 0, Late: 0 };
    this.attendances.forEach(a => { if (by[a.status as AttStatus] !== undefined) by[a.status as AttStatus]++; });
    const pct = (n: number) => total ? Math.round((n / total) * 100) : 0;
    return { total, ...by, pctPresent: pct(by.Present), pctAbsent: pct(by.Absent), pctLate: pct(by.Late) };
  }

  // --- Export
  exportExcel() {
    const rows = this.attendances.map(a => ({
      Student: a.student?.name ?? '',
      StudentId: a.student?.studentId ?? '',
      Class: a.className,
      Teacher: a.teacher,
      Username: a.username,
      Date: a.date, // raw, keep as-is for Excel
      Status: a.status
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Attendance Report', 14, 16);

    const body = this.attendances.map(a => [
      a.student?.name ?? '',
      a.student?.studentId ?? '',
      a.className,
      a.teacher,
      a.username,
      this.formatDate(a.date),   // <-- fixed: formatted date
      a.status                   // <-- fixed: separate column, not nested array
    ]);

    autoTable(doc, {
      head: [['Student', 'Student ID', 'Class', 'Teacher', 'Username', 'Date', 'Status']],
      body,
      startY: 22,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [240, 240, 240] }
    });

    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.text(
      `Total: ${this.totals.total} | Present: ${this.totals.Present} | Absent: ${this.totals.Absent} | Late: ${this.totals.Late}`,
      14,
      y
    );

    doc.save(`attendance_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  // --- UI helpers
  toggleSelectAll(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    this.students = this.students.map(s => ({ ...s, selected: checked }));
  }

  /** Getter used in template: [checked]="allSelected" */
  get allSelected(): boolean {
    return this.students.length > 0 && this.students.every(s => !!s.selected);
  }

  /** trackBy functions for ngFor */
  trackByStudent = (_: number, s: any) => s?._id ?? s?.id ?? s?.studentId ?? _;
  trackByRecord  = (_: number, r: any) => r?._id ?? _;

  /** Pager helpers used in template (avoid Math.* in HTML) */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.attendances.length / this.pageSize));
  }
  prevPage() { this.page = Math.max(1, this.page - 1); }
  nextPage() { this.page = Math.min(this.totalPages, this.page + 1); }

  /** Safe date formatter */
  private formatDate(d: any): string {
    if (!d) return '';
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return String(d);
      return dateObj.toISOString().slice(0, 10);
    } catch {
      return String(d);
    }
  }

  private msg(m: string) { this.message = m; }
}
