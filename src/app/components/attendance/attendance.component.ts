import { Component, OnInit } from '@angular/core';
import { DeviceService } from '../../services/device.service';

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
import { forkJoin } from 'rxjs';

type SortKey = 'student' | 'className' | 'teacher' | 'username' | 'date' | 'status';

interface MatrixRow {
  studentId: string | number;
  name: string;
  perDate: { [date: string]: AttStatus | '' };
}

interface AbsentEntry {
  studentId: string | number;
  name: string;
  dates: string[]; // YYYY-MM-DD where absent
}

@Component({
  selector: 'app-attendance',
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.css'],
})
export class AttendanceComponent implements OnInit {
  attendanceForm: FormGroup;
  filterForm: FormGroup;

  // All students (from backend)
  allStudents: Student[] = [];
  // Students of selected class (used for marking)
  students: Array<Student & { selected?: boolean }> = [];

  // Raw attendance records (for history / export)
  attendances: Attendance[] = [];
isMobile = false;
  // Sorting (for history table only)
  sortKey: SortKey = 'date';
  sortDir: 'asc' | 'desc' = 'desc';

  message = '';
  loading = false;

  // ------------- Matrix view (monthly style) -------------
  matrixDates: string[] = [];      // YYYY-MM-DD list for header
  matrixRows: MatrixRow[] = [];    // each row per student

  // ------------- Absent List -------------
  absentList: AbsentEntry[] = [];

  constructor(
    private fb: FormBuilder,
    private device: DeviceService,
    private attendanceService: AttendanceService
  ) {
    // Add-attendance form (left card)
    this.attendanceForm = this.fb.group({
      className: ['', Validators.required],
      teacher: ['', Validators.required],
      username: ['', Validators.required],
      date: ['', Validators.required],
      status: ['Present', Validators.required], // default for chosen students
    });

    // Filter form (right card – *independent* from attendanceForm)
    this.filterForm = this.fb.group({
      className: [''],
      studentName: [''],
      studentId: [''],
      username: [''],
      status: [''],         // Present | Absent | Leave | ''
      fromDate: [''],       // YYYY-MM-DD
      toDate: [''],         // YYYY-MM-DD
    });
  }

  // ---------------------------------------------------------------------------
  //  Lifecycle
  // ---------------------------------------------------------------------------
  ngOnInit(): void {
    this.isMobile = this.device.isMobileApp || this.device.isMobileScreen;
    const today = this.formatDate(new Date());
    this.attendanceForm.patchValue({ date: today });

    this.loadAllStudents();
  }

  // ---------------------------------------------------------------------------
  //  Students
  // ---------------------------------------------------------------------------

  /** Load all students once; we filter by class on client side */
  loadAllStudents() {
    this.attendanceService.getStudents().subscribe({
      next: (data) => {
        this.allStudents = data || [];
        // When component loads, no class selected yet → students empty
        this.students = [];
      },
      error: () => this.msg('Failed to load students.'),
    });
  }

  /** Called when user changes class in the Add Attendance form */
  onClassChange() {
    const className: string = (this.attendanceForm.value.className || '').trim();
    this.filterStudentsByClass(className);
  }

  /** Filter allStudents into students by className (for marking attendance) */
  private filterStudentsByClass(className: string) {
    if (!className) {
      this.students = [];
      return;
    }

    this.students = this.allStudents
      .filter((s) => {
        const c = (s.class as any) ?? (s as any).className ?? '';
        return String(c).trim().toLowerCase() === className.trim().toLowerCase();
      })
      .map((s) => ({ ...s, selected: false }));
  }

  getStudentLabel(student: any): string {
    if (!student) return '';
    if (typeof student === 'string') return student;
    return (
      (student.name as string) ||
      (student.fullName as string) ||
      (student.studentName as string) ||
      (student.studentId as string) ||
      (student._id as string) ||
      ''
    );
  }

  // ---------------------------------------------------------------------------
  //  Add Attendance (bulk for selected students)
  // ---------------------------------------------------------------------------

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
      this.msg('Please fill all required fields in Add Attendance.');
      return;
    }

    
const selectedStudents = this.students
  .filter((s) => s.selected && s.studentId != null);

const selectedStudentIds = selectedStudents.map((s) => s.studentId);
const selectedStudentNames = selectedStudents.map((s) => s.name);
    if (!selectedStudentIds.length) {
      this.msg('Please select at least one student.');
      return;
    }

    const form = this.attendanceForm.value;
    const payload = {
      studentIds: selectedStudentIds, // (string | number)[]
      className: form.className,
      teacher: form.teacher,
      username: selectedStudentNames.join(', '), // use selected students' names
      date: form.date, // YYYY-MM-DD
      status: this.normalizeStatus(form.status),
    };

    this.loading = true;
    this.attendanceService.saveAttendanceBulk(payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.msg(
          `Attendance saved. Created: ${res.created ?? 0}, Updated: ${res.updated ?? 0}`
        );
        // After save, refresh report for same class + date
        const fClass = this.filterForm.value.className || form.className;
        this.filterForm.patchValue({
          className: fClass,
          fromDate: form.date,
          toDate: form.date,
        });
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

  // Checkbox helpers for "select all"
  toggleSelectAll(ev: Event) {
    const checked = (ev.target as HTMLInputElement | null)?.checked ?? false;
    this.students = this.students.map((s) => ({ ...s, selected: checked }));
  }

  get allSelected(): boolean {
    return this.students.length > 0 && this.students.every((s) => !!s.selected);
  }

  // ---------------------------------------------------------------------------
  //  Filters & History Load
  // ---------------------------------------------------------------------------

  applyFilters() {
    const f = this.filterForm.value;

    // Build query independently from Add Attendance form
    const query: any = {
      className: f.className || undefined,
      name: f.studentName || undefined,
      username: f.username || undefined,
      studentId: f.studentId || undefined,
      status: f.status || undefined,
      fromDate: f.fromDate || undefined,
      toDate: f.toDate || undefined,
      // ask backend for many records at once (report usage)
      page: '1',
      limit: '1000',
    };

    this.loading = true;
    this.attendanceService.getAttendance(query).subscribe({
      next: (res) => {
        this.loading = false;
        this.handleAttendanceResponse(res);
        this.buildMatrixAndAbsentLists();
      },
      error: () => {
        this.loading = false;
        this.msg('Failed to load attendance records.');
      },
    });

    // If a class is chosen in filter and not in Add Attendance, sync students list
    if (f.className && !this.attendanceForm.value.className) {
      this.attendanceForm.patchValue({ className: f.className });
      this.filterStudentsByClass(f.className);
    }
  }

  clearFilters() {
    this.filterForm.reset();
    this.attendances = [];
    this.matrixDates = [];
    this.matrixRows = [];
    this.absentList = [];
  }

  /** Accept Paginated<Attendance> or Attendance[] */
  private handleAttendanceResponse(res: Paginated<Attendance> | Attendance[] | any) {
    if (Array.isArray(res)) {
      this.attendances = res;
      return;
    }
    this.attendances = res?.data ?? [];
  }

  // ---------------------------------------------------------------------------
  //  Matrix & Absent List
  // ---------------------------------------------------------------------------

  private buildMatrixAndAbsentLists() {
    this.matrixDates = [];
    this.matrixRows = [];
    this.absentList = [];

    if (!this.attendances.length) return;

    // Determine date range: from filter if set; else from min/max in data
    const f = this.filterForm.value;
    let from = f.fromDate ? this.formatDate(f.fromDate) : '';
    let to = f.toDate ? this.formatDate(f.toDate) : '';

    if (!from || !to) {
      const sorted = [...this.attendances].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      from = from || this.formatDate(sorted[0].date);
      to = to || this.formatDate(sorted[sorted.length - 1].date);
    }

    const allDates: string[] = [];
    let cursor = new Date(from);
    const end = new Date(to);

    while (cursor.getTime() <= end.getTime()) {
      const dStr = this.formatDate(cursor);
      allDates.push(dStr);
      cursor.setDate(cursor.getDate() + 1);
    }
    this.matrixDates = allDates;

    // Group by studentId
    const byStudent = new Map<string | number, MatrixRow>();
    const absentByStudent = new Map<string | number, AbsentEntry>();

    for (const a of this.attendances) {
      const sid = (a.studentId as any) ?? 'unknown';
      const name = this.getStudentName(a) || (a as any).studentName || '';

      if (!byStudent.has(sid)) {
        byStudent.set(sid, {
          studentId: sid,
          name,
          perDate: {},
        });
      }

      const row = byStudent.get(sid)!;
      const dateKey = this.formatDate(a.date);
      if (allDates.includes(dateKey)) {
        row.perDate[dateKey] = a.status as AttStatus;
      }

      if ((a.status as AttStatus) === 'Absent') {
        if (!absentByStudent.has(sid)) {
          absentByStudent.set(sid, {
            studentId: sid,
            name,
            dates: [],
          });
        }
        const entry = absentByStudent.get(sid)!;
        if (!entry.dates.includes(dateKey)) {
          entry.dates.push(dateKey);
        }
      }
    }

    this.matrixRows = Array.from(byStudent.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Sort each absent dates array
    this.absentList = Array.from(absentByStudent.values()).map((e) => ({
      ...e,
      dates: e.dates.sort(),
    }));
  }

  // ---------------------------------------------------------------------------
  //  History table & delete
  // ---------------------------------------------------------------------------

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

  get sortedHistory(): Attendance[] {
    const data = [...this.attendances];
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return data.sort((a, b) => {
      const av = this.sortValue(a, this.sortKey);
      const bv = this.sortValue(b, this.sortKey);
      return av > bv ? dir : av < bv ? -dir : 0;
    });
  }

  deleteAttendance(id: string) {
    if (!id) return;
    if (!confirm('Delete this attendance record?')) return;
    this.attendanceService.deleteAttendance(id).subscribe({
      next: () => {
        this.msg('Attendance deleted successfully.');
        this.applyFilters();
      },
      error: () => this.msg('Failed to delete attendance.'),
    });
  }

  /** Delete all records in the current filter result (frontend loop, backend unchanged) */
  deleteAllInCurrentFilter() {
    if (!this.attendances.length) {
      alert('No records to delete for current filter.');
      return;
    }

    const ok = confirm(
      `Delete ALL ${this.attendances.length} attendance record(s) shown in this report?`
    );
    if (!ok) return;

    const ops = this.attendances
      .filter((a) => !!a._id)
      .map((a) => this.attendanceService.deleteAttendance(a._id!));

    if (!ops.length) return;

    this.loading = true;
    forkJoin(ops).subscribe({
      next: () => {
        this.loading = false;
        this.msg('All filtered attendance records deleted.');
        this.applyFilters();
      },
      error: () => {
        this.loading = false;
        this.msg('Failed to delete all records.');
      },
    });
  }

  trackByRecord = (_: number, r: any) => r?._id ?? _;

  // ---------------------------------------------------------------------------
  //  Export
  // ---------------------------------------------------------------------------

  exportExcel() {
    // We'll export the sorted history (flat) + matrix info as columns only by status.
    const rows = this.sortedHistory.map((a) => ({
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

    XLSX.writeFile(
      wb,
      `attendance_report_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Attendance Report', 14, 16);

    const body = this.sortedHistory.map((a) => [
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

    const y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.text(
      `Total records: ${this.attendances.length}`,
      14,
      y
    );

    doc.save(`attendance_report_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  /** Resolve student name from studentId using loaded allStudents[] list */
  getStudentName(r: Attendance): string {
    const stu = this.allStudents.find((s) => s.studentId === r.studentId);
    return stu?.name ?? '';
  }

  getStudentId(r: Attendance): string | number {
    return r.studentId ?? '';
  }

  /** Safe date formatter -> YYYY-MM-DD (accepts Date or any) */
  public formatDate(d: any): string {
    if (!d) return '';
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return String(d);
      return new Date(
        dateObj.getTime() - dateObj.getTimezoneOffset() * 60000
      )
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
