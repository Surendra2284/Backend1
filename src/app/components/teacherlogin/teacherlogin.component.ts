import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { StudentService, Student } from '../../services/student.service';
import { NoticeService, Notice } from '../../services/notice.service';
import { AttendanceService, Attendance, AttStatus } from '../../services/attendance.service';
import { TeacherService } from '../../services/teacher.service';
import { Teacher } from '../../components/models/Teacher';
import { forkJoin, of } from 'rxjs';

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

  /** UI attendance state: keyed by Student.studentId (number) */
  attendance: { [studentId: number]: AttStatus } = {};

  attendanceRecords: Attendance[] = [];

  // UI helpers
  message = '';
  loading = false;

  constructor(
    private studentService: StudentService,
    private noticeService: NoticeService,
    private attendanceService: AttendanceService,
    private teacherService: TeacherService
  ) {}

  ngOnInit(): void {
    const username = localStorage.getItem('username');
    if (!username) {
      alert('Session expired. Please log in again.');
      return;
    }

    this.teacherService.getTeacherByUsername(username).subscribe({
      next: (teacher) => {
        this.loggedInTeacher = teacher;
        this.displayName = teacher?.name || 'Teacher';

        if (teacher?.Assignclass) {
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
  }

  selectTab(tab: string) {
    this.activeTab = tab;
  }

  // ========== Students ==========
  loadStudents(): void {
    const className = this.loggedInTeacher?.Assignclass;
    if (!className) {
      console.warn('No class assigned to teacher. Cannot load students.');
      return;
    }

    this.studentService.searchStudentsByClass(className).subscribe({
      next: (students) => {
        this.students = (students || []).filter(s => s.class === className);

        // Initialize default UI attendance as 'Absent'
        this.students.forEach(stu => {
          if (!Object.prototype.hasOwnProperty.call(this.attendance, stu.studentId)) {
            this.attendance[stu.studentId] = 'Absent';
          }
        });
      },
      error: (err) => console.error('Error loading students:', err)
    });
  }

  editStudent(student: Student) {
    const newName = prompt('Edit name:', student.name);
    const updated = { ...student, name: newName ?? student.name };
    this.studentService.updateStudent(student.studentId, updated).subscribe({
      next: () => this.loadStudents(),
      error: (err) => console.error('Error updating student:', err)
    });
  }

  deleteStudent(studentId: number) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    this.studentService.deleteStudent(studentId).subscribe({
      next: () => this.loadStudents(),
      error: (err) => console.error('Error deleting student:', err)
    });
  }

  // ========== Notices ==========
  loadNotices() {
    this.noticeService.getNoticesByClassTeacher(this.displayName).subscribe({
      next: (data) => this.teacherNotices = data || [],
      error: (err) => console.error('Error loading notices:', err)
    });
  }

  addNotice() {
    if (!this.loggedInTeacher?.Assignclass) {
      alert('No class assigned to teacher — cannot post a notice.');
      return;
    }

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
    const updatedText = prompt('Edit notice:', notice.Notice);
    const updated = { ...notice, Notice: updatedText ?? notice.Notice };
    this.noticeService.editNotice(notice._id!, updated).subscribe({
      next: () => this.loadNotices(),
      error: (err) => console.error('Error editing notice:', err)
    });
  }

  deleteNotice(id: string) {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    this.noticeService.deleteNotice(id).subscribe({
      next: () => this.loadNotices(),
      error: (err) => console.error('Error deleting notice:', err)
    });
  }

  // ========== Attendance ==========
  loadAttendance() {
    const className = this.loggedInTeacher?.Assignclass;
    if (!className) return;

    // Use the helper that returns just the array to avoid Paginated<T> type issues.
    this.attendanceService.getAttendanceListOnly({ className, page: 1, limit: 500 }).subscribe({
      next: (list) => {
        this.attendanceRecords = list || [];

        // Build latest status per studentId (records are sorted by date desc in API)
        const latestPerStudent = new Map<number, AttStatus>();
        this.attendanceRecords.forEach(r => {
          const sid = this.getStudentIdFromRecord(r);
          if (typeof sid === 'number' && !latestPerStudent.has(sid)) {
            latestPerStudent.set(sid, r.status as AttStatus);
          }
        });

        // Seed UI state with latest known values
        this.students.forEach(stu => {
          const v = latestPerStudent.get(stu.studentId);
          if (v) this.attendance[stu.studentId] = v;
        });
      },
      error: (err) => console.error('Error loading attendance:', err)
    });
  }

  /** Called by the three "Mark all" buttons in the template */
  markAll(status: AttStatus) {
    this.students.forEach(s => {
      this.attendance[s.studentId] = status;
    });
  }

  /** Bulk save attendance for entire class (group by status) */
  saveAttendance() {
    if (!this.loggedInTeacher?.Assignclass) {
      alert('No class assigned to teacher.');
      return;
    }

    const className = this.loggedInTeacher.Assignclass;
    const teacher = this.displayName || 'Teacher';
    const username = localStorage.getItem('username') || this.displayName || 'teacher';
    const date = this.today(); // YYYY-MM-DD

    // Map studentId -> ObjectId
    const idByStudentId = new Map<number, string>();
    this.students.forEach(s => {
      const oid = (s as any)?._id;
      if (oid) idByStudentId.set(s.studentId, String(oid));
    });

    const presentIds: string[] = [];
    const absentIds: string[]  = [];
    const leaveIds: string[]   = [];

    this.students.forEach(s => {
      const sid = s.studentId;
      const oid = idByStudentId.get(sid);
      if (!oid) return;

      // Normalize in case older UI states used "Late"
      const status = this.normalizeStatus(this.attendance[sid] || 'Absent');

      if (status === 'Present') presentIds.push(oid);
      else if (status === 'Leave') leaveIds.push(oid);
      else absentIds.push(oid);
    });

    if (presentIds.length + absentIds.length + leaveIds.length === 0) {
      alert('No students found to save attendance for.');
      return;
    }

    this.loading = true;

    const calls = [];
    if (presentIds.length) {
      calls.push(this.attendanceService.saveAttendanceBulk({
        studentIds: presentIds, className, teacher, username, date, status: 'Present'
      }));
    }
    if (absentIds.length) {
      calls.push(this.attendanceService.saveAttendanceBulk({
        studentIds: absentIds, className, teacher, username, date, status: 'Absent'
      }));
    }
    if (leaveIds.length) {
      calls.push(this.attendanceService.saveAttendanceBulk({
        studentIds: leaveIds, className, teacher, username, date, status: 'Leave'
      }));
    }

    forkJoin(calls.length ? calls : [of(null)]).subscribe({
      next: () => {
        this.loading = false;
        alert('Attendance saved successfully!');
        this.loadAttendance();
      },
      error: (err) => {
        this.loading = false;
        console.error('Error saving attendance:', err);
        alert('Failed to save attendance.');
      }
    });
  }

  // ========== Session ==========
  logout() {
    localStorage.removeItem('username');
    alert('Logged out successfully!');
  }

  // ========== Helpers ==========
  /** Map any legacy string (e.g. "Late") to current AttStatus union. */
  private normalizeStatus(val: any): AttStatus {
    const map: Record<string, AttStatus> = {
      present: 'Present',
      absent: 'Absent',
      leave: 'Leave',
      late: 'Leave', // legacy -> map to Leave
    };
    return map[String(val || '').toLowerCase()] ?? 'Present';
  }

  /** Extract numeric studentId from Attendance.student (which may be a string or Student). */
  private getStudentIdFromRecord(r: Attendance): number | undefined {
    const s: any = r?.student;
    if (s && typeof s === 'object' && typeof s.studentId === 'number') return s.studentId;
    return undefined;
  }

  private today(): string {
    const d = new Date();
    const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
    return localISO.slice(0, 10);
  }
}
