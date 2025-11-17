import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { StudentService } from '../../services/student.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-student',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student.component.html',
  styleUrls: ['./student.component.css'],
})
export class StudentComponent implements OnInit {

  students: any[] = [];
  currentStudent: any = {};
  isEditing = false;

  searchQuery = '';
  searchBy: 'class' | 'name' = 'class';

  bulkPreview: any[] = [];
  bulkErrors: string[] = [];
  upsertMode = true;

  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  filters: any = {
    studentId: '',
    name: '',
    class: '',
    mobileNo: '',
    Email: '',
    Role: '',
    attendance: '',
    classteacher: '',
  };

  page = 1;
  pageSize = 10;

  private headerMap: Record<string, string> = {
    studentid: 'studentId',
    name: 'name',
    class: 'class',
    mobileno: 'mobileNo',
    address: 'address',
    role: 'Role',
    email: 'Email',
    attendance: 'attendance',
    classteacher: 'classteacher',
    photo: 'photo',
  };

  constructor(private studentService: StudentService) {}

  ngOnInit(): void {
    this.getStudents();
  }

  /* ---------------------------------- LOAD ---------------------------------- */

  getStudents(): void {
    this.studentService.getStudents().subscribe({
      next: (res) => {
        this.students = res || [];
        this.page = 1;
      },
      error: (err) => console.error(err),
    });
  }

  /* ------------------------------- FILE UPLOAD ------------------------------- */

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.src = e.target.result;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        const MAX_WIDTH = 300;
        const scale = MAX_WIDTH / img.width;

        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        this.currentStudent.photo = canvas.toDataURL('image/jpeg', 0.7);
      };
    };
    reader.readAsDataURL(file);
  }

  /* ----------------------------------- SAVE ---------------------------------- */

  saveStudent(form: NgForm): void {
    if (this.isEditing) {
      this.studentService
        .updateStudent(this.currentStudent.studentId, this.currentStudent)
        .subscribe(() => {
          this.getStudents();
          this.resetForm(form);
        });
    } else {
      this.studentService.addStudent(this.currentStudent).subscribe(() => {
        this.getStudents();
        this.resetForm(form);
      });
    }
  }

  editStudent(student: any): void {
    this.isEditing = true;
    this.currentStudent = { ...student };
  }

  deleteStudent(id: number): void {
    if (!confirm('Delete this student?')) return;
    this.studentService.deleteStudent(id).subscribe(() => this.getStudents());
  }

  resetForm(form: NgForm) {
    this.isEditing = false;
    this.currentStudent = {};
    form.reset();
  }

  /* ---------------------------------- SEARCH --------------------------------- */

  searchStudents() {
    if (!this.searchQuery) return this.getStudents();
    this.page = 1;

    if (this.searchBy === 'class') {
      this.studentService.searchStudentsByClass(this.searchQuery).subscribe((d) => (this.students = d));
    } else {
      this.studentService.searchStudentsByName(this.searchQuery).subscribe((d) => (this.students = d));
    }
  }

  /* ----------------------------------- SORT ---------------------------------- */

  sortData(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.page = 1;
  }

  /* -------------------------------- FILTER + SORT ----------------------------- */

  getFilteredAndSortedStudents(): any[] {
    let list = this.students.filter((s) =>
      Object.keys(this.filters).every((key) =>
        !this.filters[key] ||
        s[key]?.toString().toLowerCase().includes(this.filters[key].toLowerCase())
      )
    );

    if (this.sortColumn) {
      list.sort((a, b) => {
        const A = a[this.sortColumn];
        const B = b[this.sortColumn];

        if (A == null) return 1;
        if (B == null) return -1;

        return typeof A === 'number'
          ? this.sortDirection === 'asc' ? A - B : B - A
          : this.sortDirection === 'asc'
          ? A.localeCompare(B)
          : B.localeCompare(A);
      });
    }

    return list;
  }

  /* -------------------------------- PAGINATION -------------------------------- */

  get paginatedStudents() {
    const list = this.getFilteredAndSortedStudents();
    const start = (this.page - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.getFilteredAndSortedStudents().length / this.pageSize));
  }

  prevPage() { if (this.page > 1) this.page--; }
  nextPage() { if (this.page < this.totalPages) this.page++; }
  goToPage(n: number) { if (n >= 1 && n <= this.totalPages) this.page = n; }

  onPageSizeChange(v: string) {
    this.pageSize = Number(v) || 10;
    this.page = 1;
  }

  /* --------------------------------- FILTER RESET ----------------------------- */

  clearFilters() {
    this.filters = {
      studentId: '',
      name: '',
      class: '',
      mobileNo: '',
      Email: '',
      Role: '',
      attendance: '',
      classteacher: '',
    };
    this.page = 1;
  }

  /* -------------------------------- BULK IMPORT ------------------------------- */

  async onExcelSelected(event: any) {
    this.bulkPreview = [];
    this.bulkErrors = [];

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.SheetNames[0];

      const json = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheet], { defval: '' });

      const seen = new Set<number>();
      const MOBILE = /^[6-9]\d{9}$/;

      this.bulkPreview = json.map((row, i) => {
        const obj: any = {};
        Object.keys(row).forEach((k) => {
          const real = this.headerMap[k.toLowerCase().trim()];
          if (real) obj[real] = row[k];
        });

        const rowNum = i + 2;

        // Validation
        if (!obj.studentId) this.bulkErrors.push(`Row ${rowNum} StudentId missing`);
        obj.studentId = Number(obj.studentId);

        if (seen.has(obj.studentId)) this.bulkErrors.push(`Row ${rowNum} Duplicate StudentId`);
        else seen.add(obj.studentId);

        if (!obj.name) this.bulkErrors.push(`Row ${rowNum} Name required`);
        if (!obj.class) this.bulkErrors.push(`Row ${rowNum} Class required`);

        if (!MOBILE.test(String(obj.mobileNo)))
          this.bulkErrors.push(`Row ${rowNum} Invalid Mobile`);

        return obj;
      });
    } catch (err) {
      this.bulkErrors.push('Invalid Excel file');
    }
  }

  commitBulk() {
    if (!this.bulkPreview.length) return alert('No rows loaded.');
    if (this.bulkErrors.length) return alert('Fix all errors first.');

    this.studentService.bulkAddStudents(this.bulkPreview, { upsert: this.upsertMode }).subscribe({
      next: (res) => {
        alert(
          `Imported.\nInserted: ${res.inserted}\nUpdated: ${res.updated}\nSkipped: ${res.skipped}`
        );
        this.getStudents();
        this.bulkPreview = [];
      },
    });
  }

  /* ---------------------------------- REPORTS -------------------------------- */

  getClassReport() {
    const list = this.getFilteredAndSortedStudents();
    const map = new Map<string, { count: number; sum: number }>();

    for (const s of list) {
      const c = s.class;
      const att = Number(s.attendance || 0);

      if (!map.has(c)) map.set(c, { count: 0, sum: 0 });

      const rec = map.get(c)!;
      rec.count++;
      rec.sum += att;
    }

    return Array.from(map.entries()).map(([className, v]) => ({
      className,
      count: v.count,
      avgAttendance: v.count ? +(v.sum / v.count).toFixed(2) : 0,
    }));
  }

  exportClassReport() {
    const report = this.getClassReport();
    if (!report.length) return alert('Nothing to export');

    const ws = XLSX.utils.json_to_sheet(report);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    XLSX.writeFile(wb, 'class_report.xlsx');
  }

  downloadTemplate() {
    const sample = [
      {
        StudentId: 1001,
        Name: 'Aarav Kumar',
        Class: '10-A',
        MobileNo: '9876543210',
        Email: 'example@mail.com',
        Role: 'Student',
        Classteacher: 'Teacher1',
        Address: 'City',
        Attendance: 0,
        Photo: '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'students_template.xlsx');
  }

  /* -------------------------------- TRACK BY -------------------------------- */

  trackByStudent(_: number, s: any) {
    return s?.studentId || _;
  }
}
