import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { StudentService } from '../../services/student.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  // Sorting state
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

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
  }
}