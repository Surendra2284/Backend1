import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentService, Student } from '../../services/student.service';
import { NoticeService, Notice } from '../../services/notice.service';
import { AttendanceService, Attendance } from '../../services/attendance.service';
import { TeacherService } from '../../services/teacher.service';
import { Teacher } from '../../components/models/Teacher';

@Component({
  selector: 'app-teacherlogin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacherlogin.component.html',
  styleUrls: ['./teacherlogin.component.css']
})
export class TeacherloginComponent implements OnInit {
  activeTab: string = 'students';
  loggedInTeacher!: Teacher;
  displayName: string = '';
  students: Student[] = [];
  teacherNotices: Notice[] = [];
  newNotice: Partial<Notice> = { Notice: '' };

  attendance: { [studentId: string]: 'Present' | 'Absent' | 'Late' } = {};
  attendanceRecords: Attendance[] = [];

  constructor(
    private studentService: StudentService,
    private noticeService: NoticeService,
    private attendanceService: AttendanceService,
    private teacherService: TeacherService
  ) {}

  ngOnInit(): void {
    const username = localStorage.getItem('username');
    if (username) {
      this.teacherService.getTeacherByUsername(username).subscribe({
        next: (teacher) => {
          this.loggedInTeacher = teacher;
          this.displayName = teacher.name || 'Teacher';

          if (teacher.Assignclass) {
            this.loadStudents();
            this.loadNotices();
            this.loadAttendance();
          } else {
            console.warn('Teacher has no assigned class.');
          }
        },
        error: (err) => {
          console.error('Failed to load teacher:', err);
          alert('Unable to load teacher information. Please try again.');
        }
      });
    } else {
      alert('Session expired. Please log in again.');
    }
  }

  selectTab(tab: string) {
    this.activeTab = tab;
  }

  // --- Students ---
  loadStudents(): void {
  const className = this.loggedInTeacher?.Assignclass;
  if (!className) {
    console.warn('No class assigned to teacher. Cannot load students.');
    return;
  }
 console.warn('No class assigned to teacher. Cannot load students.');
  this.studentService.searchStudentsByClass(className).subscribe({
    next: (students) => {
      // Filter strictly by class, in case backend returns extras
      this.students = students.filter(s => s.class === className);

      // Initialize attendance map
      this.students.forEach(student => {
        if (!this.attendance[student.studentId]) {
          this.attendance[student.studentId] = 'Absent';
        }
      });
    },
    error: (err) => console.error('Error loading students:', err)
  });
}

  editStudent(student: Student) {
    const updated = { ...student, name: prompt('Edit name:', student.name) || student.name };
    this.studentService.updateStudent(student.studentId, updated).subscribe({
      next: () => this.loadStudents(),
      error: (err) => console.error('Error updating student:', err)
    });
  }

  deleteStudent(studentId: number) {
    if (confirm('Are you sure you want to delete this student?')) {
      this.studentService.deleteStudent(studentId).subscribe({
        next: () => this.loadStudents(),
        error: (err) => console.error('Error deleting student:', err)
      });
    }
  }

  // --- Notices ---
  loadNotices() {
    this.noticeService.getNoticesByClassTeacher(this.displayName).subscribe({
      next: (data) => this.teacherNotices = data,

      error: (err) => console.error('Error loading notices:', err)
    });
  }

  addNotice() {
    const notice: Notice = {
      Noticeid: Date.now().toString(),
      name: this.displayName,
      class: this.loggedInTeacher.Assignclass,
      Role: 'Teacher',
      Notice: this.newNotice.Notice || '',
      classteacher: this.displayName
    };
    this.noticeService.addNotice(notice).subscribe({
      next: () => {
        this.newNotice = { Notice: '' };
        this.loadNotices();
      },
      error: (err) => console.error('Error posting notice:', err)
    });
  }

  editNotice(notice: Notice) {
    const updated = { ...notice, Notice: prompt('Edit notice:', notice.Notice) || notice.Notice };
    this.noticeService.editNotice(notice._id!, updated).subscribe({
      next: () => this.loadNotices(),
      error: (err) => console.error('Error editing notice:', err)
    });
  }

  deleteNotice(id: string) {
    if (confirm('Are you sure you want to delete this notice?')) {
      this.noticeService.deleteNotice(id).subscribe({
        next: () => this.loadNotices(),
        error: (err) => console.error('Error deleting notice:', err)
      });
    }
  }

  // --- Attendance ---
  loadAttendance() {
    this.attendanceService.getAttendance().subscribe({
      next: (records) => {
        this.attendanceRecords = records.filter(r => r.className === this.loggedInTeacher.Assignclass);
        this.attendanceRecords.forEach(r => {
          this.attendance[r.studentId] = r.status;
        });
      },
      error: (err) => console.error('Error loading attendance:', err)
    });
  }

  saveAttendance() {
    const today = new Date().toISOString().split('T')[0];
    this.students.forEach(student => {
      const record: Attendance = {
        studentId: student.studentId.toString(),
        name: student.name,
        className: this.loggedInTeacher.Assignclass,
        teacher: this.displayName,
        date: today,
        status: this.attendance[student.studentId] || 'Absent'
      };
      this.attendanceService.saveAttendance(record).subscribe({
        next: () => console.log('Saved attendance for', student.name),
        error: (err) => console.error('Error saving attendance:', err)
      });
    });
    alert('Attendance saved successfully!');
  }

  logout() {
    localStorage.removeItem('username');
    alert('Logged out successfully!');
  }
}