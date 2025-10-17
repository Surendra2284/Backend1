import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentService, Student } from '../../services/student.service';
import { NoticeService, Notice } from '../../services/notice.service';
import { AttendanceService, Attendance } from '../../services/attendance.service';

@Component({
  selector: 'app-teacherlogin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacherlogin.component.html',
  styleUrls: ['./teacherlogin.component.css']
})
export class TeacherloginComponent implements OnInit {
  activeTab: string = 'students';
  loggedInTeacher: any;
  displayName: string = '';
  students: Student[] = [];
  teacherNotices: Notice[] = [];
  newNotice: Partial<Notice> = { Notice: '' };

  // Attendance
  attendance: { [studentId: string]: 'Present' | 'Absent' | 'Late' } = {};
  attendanceRecords: Attendance[] = [];

  constructor(
    private studentService: StudentService,
    private noticeService: NoticeService,
    private attendanceService: AttendanceService
  ) {}

  ngOnInit(): void {
    this.loggedInTeacher = JSON.parse(localStorage.getItem('teacher') || '{}');
    this.displayName =
      this.loggedInTeacher?.name ||
      this.loggedInTeacher?.username ||
      this.loggedInTeacher?.Name ||
      'Teacher';

    if (this.loggedInTeacher?.class) {
      this.loadStudents();
      this.loadNotices();
      this.loadAttendance();
    }
  }

  selectTab(tab: string) {
    this.activeTab = tab;
  }

  // --- Students ---
  loadStudents() {
    this.studentService.searchStudentsByClass(this.loggedInTeacher.class)
      .subscribe({
        next: (data) => {
          this.students = data;
          // Initialize attendance map
          this.students.forEach(s => {
            if (!this.attendance[s.studentId]) {
              this.attendance[s.studentId] = 'Absent';
            }
          });
        },
        error: (err) => console.error(err)
      });
  }

  editStudent(student: Student) {
    const updated = { ...student, name: prompt('Edit name:', student.name) || student.name };
    this.studentService.updateStudent(student.studentId, updated).subscribe({
      next: () => this.loadStudents(),
      error: (err) => console.error(err)
    });
  }

  deleteStudent(studentId: number) {
    if (confirm('Are you sure you want to delete this student?')) {
      this.studentService.deleteStudent(studentId).subscribe({
        next: () => this.loadStudents(),
        error: (err) => console.error(err)
      });
    }
  }

  // --- Notices ---
  loadNotices() {
    this.noticeService.getNoticesByClassTeacher(this.displayName)
      .subscribe({
        next: (data) => this.teacherNotices = data,
        error: (err) => console.error(err)
      });
  }

  addNotice() {
    const notice: Notice = {
      Noticeid: Date.now().toString(),
      name: this.displayName,
      class: this.loggedInTeacher.class,
      Role: 'Teacher',
      Notice: this.newNotice.Notice || '',
      classteacher: this.displayName
    };
    this.noticeService.addNotice(notice).subscribe({
      next: () => {
        this.newNotice = { Notice: '' };
        this.loadNotices();
      },
      error: (err) => console.error(err)
    });
  }

  editNotice(notice: Notice) {
    const updated = { ...notice, Notice: prompt('Edit notice:', notice.Notice) || notice.Notice };
    this.noticeService.editNotice(notice._id!, updated).subscribe({
      next: () => this.loadNotices(),
      error: (err) => console.error(err)
    });
  }

  deleteNotice(id: string) {
    if (confirm('Are you sure you want to delete this notice?')) {
      this.noticeService.deleteNotice(id).subscribe({
        next: () => this.loadNotices(),
        error: (err) => console.error(err)
      });
    }
  }

  // --- Attendance ---
  loadAttendance() {
    this.attendanceService.getAttendance().subscribe({
      next: (records) => {
        this.attendanceRecords = records.filter(r => r.className === this.loggedInTeacher.class);
        // Pre-fill attendance map if records exist
        this.attendanceRecords.forEach(r => {
          this.attendance[r.studentId] = r.status;
        });
      },
      error: (err) => console.error(err)
    });
  }

  saveAttendance() {
    const today = new Date().toISOString().split('T')[0];
    this.students.forEach(student => {
      const record: Attendance = {
        studentId: student.studentId.toString(),
        name: student.name,
        className: this.loggedInTeacher.class,
        teacher: this.displayName,
        date: today,
        status: this.attendance[student.studentId] || 'Absent'
      };
      this.attendanceService.saveAttendance(record).subscribe({
        next: () => console.log('Saved attendance for', student.name),
        error: (err) => console.error(err)
      });
    });
    alert('Attendance saved successfully!');
  }

  performAction() {
    alert('Performing teacher action...');
  }

  logout() {
    localStorage.removeItem('teacher');
    alert('Logged out successfully!');
  }
}