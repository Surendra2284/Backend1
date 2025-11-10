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
  styleUrls: ['./student.component.css']
})
export class StudentComponent implements OnInit {
  students: any[] = [];
  currentStudent: any = {};
  isEditing: boolean = false;
  searchQuery: string = '';
  searchBy: string = 'class';
bulkPreview: any[] = [];
bulkErrors: string[] = [];
upsertMode = true; 
  // Sorting state
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
private headerMap: Record<string, string> = {
  'studentid': 'studentId',
  'name': 'name',
  'class': 'class',
  'mobileno': 'mobileNo',
  'address': 'address',
  'role': 'Role',
  'email': 'Email',
  'attendance': 'attendance',
  'classteacher': 'classteacher',
  // optional: 'photo' as base64 or URL (we’ll accept but warn if too large)
  'photo': 'photo'
};
  // Filters
  filters: any = {
    studentId: '',
    name: '',
    class: '',
    mobileNo: '',
    Email: '',
    Role: '',
    attendance: '',
    classteacher: ''
  };

  constructor(private studentService: StudentService) {}

  ngOnInit(): void {
    this.getStudents();
  }

  getStudents(): void {
    this.studentService.getStudents().subscribe(
      (data) => (this.students = data),
      (error) => console.error('Error fetching students:', error)
    );
  }

  /** ✅ Resize and compress image before saving */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.src = e.target.result;

        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;

          const MAX_WIDTH = 300;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Compress to JPEG with 0.7 quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

          this.currentStudent.photo = compressedBase64;
        };
      };
      reader.readAsDataURL(file);
    }
  }

  saveStudent(form: NgForm): void {
    console.log('Form valid?', form.valid, form.value);

    

  console.log('Save Student triggered', this.currentStudent);
  

    if (this.isEditing) {
      this.studentService
        .updateStudent(this.currentStudent.studentId, this.currentStudent)
        .subscribe(
          () => {
            this.getStudents();
            this.resetForm(form);
          },
          (error) => console.error('Error updating student:', error)
        );
    } else { console.log('Save Student triggered', this.currentStudent);
      this.studentService.addStudent(this.currentStudent).subscribe(
        () => {
          this.getStudents();
          this.resetForm(form);
        },
        (error) => console.error('Error adding student:', error)
      );
    }
  }

  editStudent(student: any): void {
    this.isEditing = true;
    this.currentStudent = { ...student };
  }

  deleteStudent(studentId: number): void {
    this.studentService.deleteStudent(studentId).subscribe(
      () => this.getStudents(),
      (error) => console.error('Error deleting student:', error)
    );
  }

  searchStudents(): void {
    if (this.searchBy === 'class') {
      this.studentService.searchStudentsByClass(this.searchQuery).subscribe(
        (data) => (this.students = data),
        (error) => console.error('Error searching students by class:', error)
      );
    } else if (this.searchBy === 'name') {
      this.studentService.searchStudentsByName(this.searchQuery).subscribe(
        (data) => (this.students = data),
        (error) => console.error('Error searching students by name:', error)
      );
    }
  }

  resetForm(form: NgForm): void {
    this.isEditing = false;
    this.currentStudent = {};
    form.reset();
  }

  // Sorting
  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  // Filtering + Sorting combined
  getFilteredAndSortedStudents(): any[] {
    let filtered = this.students.filter((student) => {
      return Object.keys(this.filters).every((key) => {
        if (!this.filters[key]) return true;
        return student[key]?.toString().toLowerCase().includes(this.filters[key].toLowerCase());
      });
    });

    if (this.sortColumn) {
      filtered = filtered.sort((a, b) => {
        const valA = a[this.sortColumn];
        const valB = b[this.sortColumn];
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return this.sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        return this.sortDirection === 'asc'
          ? valA.toString().localeCompare(valB.toString())
          : valB.toString().localeCompare(valA.toString());
      });
    }

    return filtered;
  }

  clearFilters(): void {
    this.filters = {
      studentId: '',
      name: '',
      class: '',
      mobileNo: '',
      Email: '',
      Role: '',
      attendance: '',
      classteacher: ''
    };
  }downloadTemplate(): void {
  const rows = [
    {
      StudentId: 1001,
      Name: 'Aarav Kumar',
      Class: '10-A',
      MobileNo: '9876543210',
      Address: 'City',
      Role: 'Student',
      Email: 'aarav@example.com',
      Attendance: 0,
      ClassTeacher: 'Mrs. Sharma',
      Photo: '' // optional base64 or URL
    }
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');
  XLSX.writeFile(wb, 'students_template.xlsx');
}async onExcelSelected(event: Event): Promise<void> {
  this.bulkPreview = [];
  this.bulkErrors = [];

  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = wb.SheetNames[0];
    const json = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheet], { defval: '' });

    if (!json.length) {
      this.bulkErrors.push('Excel sheet is empty.');
      return;
    }

    // Normalize headers and map to API fields
    const mapped = json.map((row: any, idx: number) => this.normalizeRow(row, idx + 2)); // +2 -> excel row numbers (1 is header)

    // basic validation pass
    const MOBILE_RE = /^[6-9]\d{9}$/;
    const seen = new Set<number>();
    mapped.forEach((s, i) => {
      const rowNum = i + 2;

      if (s.studentId == null || s.studentId === '') {
        this.bulkErrors.push(`Row ${rowNum}: StudentId is required`);
      } else {
        s.studentId = Number(s.studentId);
        if (Number.isNaN(s.studentId)) this.bulkErrors.push(`Row ${rowNum}: StudentId must be a number`);
      }

      if (!s.name) this.bulkErrors.push(`Row ${rowNum}: Name is required`);
      if (!s.class) this.bulkErrors.push(`Row ${rowNum}: Class is required`);
      if (!s.Email) this.bulkErrors.push(`Row ${rowNum}: Email is required`);
      if (!s.mobileNo || !MOBILE_RE.test(String(s.mobileNo))) {
        this.bulkErrors.push(`Row ${rowNum}: MobileNo must be a valid 10-digit Indian number`);
      }

      if (seen.has(s.studentId)) this.bulkErrors.push(`Row ${rowNum}: Duplicate StudentId in the file (${s.studentId})`);
      else seen.add(s.studentId);

      // attendance numeric fallback
      if (s.attendance != null && s.attendance !== '') {
        s.attendance = Number(s.attendance);
        if (Number.isNaN(s.attendance)) s.attendance = 0;
      } else {
        s.attendance = 0;
      }
    });

    this.bulkPreview = mapped;
  } catch (e) {
    console.error(e);
    this.bulkErrors.push('Failed to read Excel. Ensure it is .xlsx and the first sheet contains data.');
  }
}

private normalizeRow(row: any, rowNum: number) {
  const normalized: any = {};
  Object.keys(row).forEach((key: string) => {
    const apiKey = this.headerMap[key.trim().toLowerCase()];
    if (apiKey) normalized[apiKey] = row[key];
  });

  // ensure all known fields exist
  for (const k of Object.values(this.headerMap)) {
    if (!(k in normalized)) normalized[k] = '';
  }
  return normalized;
}

// Commit to backend
commitBulk(): void {
  if (!this.bulkPreview.length) {
    alert('No rows to import. Please select an Excel file first.');
    return;
  }
  if (this.bulkErrors.length) {
    alert('Please fix the errors before importing.');
    return;
  }

  this.studentService.bulkAddStudents(this.bulkPreview, { upsert: this.upsertMode }).subscribe({
    next: (res) => {
      const msg =
        `Imported successfully.\n` +
        `Inserted: ${res.inserted}, Updated: ${res.updated}, Skipped: ${res.skipped}\n` +
        (res.errors?.length ? `Errors: ${res.errors.length} (see console)` : '');
      alert(msg);
      if (res.errors?.length) console.table(res.errors);
      this.getStudents();
      this.bulkPreview = [];
    },
    error: (err) => {
      console.error(err);
      alert('Bulk Uimport failed.');
    }
  });
}
}