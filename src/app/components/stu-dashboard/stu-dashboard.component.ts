import { Component, OnInit, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { StudentService } from '../../services/student.service';
import {
  AttendanceService,
  Attendance,
  WeekAttendance,
  StudentAttendanceByNameResponse
} from '../../services/attendance.service';
import { NoticeService } from '../../services/notice.service';
import {
  StudentProgressService,
  StudentProgress,
} from '../../services/student-progress.service';

@Component({
  selector: 'app-stu-dashboard',
  templateUrl: './stu-dashboard.component.html',
  styleUrls: ['./stu-dashboard.component.css']
})
export class StuDashboardComponent implements OnInit {

  /* --------------------------
     UI References (Sidebar)
  ---------------------------*/
  @ViewChild('studentSidebar') studentSidebar!: ElementRef;
  @ViewChild('studentMainContent') studentMainContent!: ElementRef;

  activeTab: string = 'dashboard';

  /* --------------------------
     Student Info
  ---------------------------*/
  student: any = null;
  username = '';
  studentId: number = 0;

  /* --------------------------
     Attendance
  ---------------------------*/
  attendanceRecords: Attendance[] = [];
  weeklyAttendance: WeekAttendance[] = [];
  attendanceSummary = '';
  attendancePercent = 0;
  attendanceError = '';
  loadingAttendance = false;

  /* --------------------------
     Notices
  ---------------------------*/
  notices: any[] = [];
  classTeacherName = '';

  /* --------------------------
     Homework / Progress
  ---------------------------*/
  myProgressList: StudentProgress[] = [];
  remarkMap: { [id: string]: string } = {};
  homeworkDonePercent = 0;

  fromDate: string = '';
  toDate: string = '';
  subjectFilter: string = '';

  loading = false;
  message = '';

  constructor(
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private progressService: StudentProgressService,
    private renderer: Renderer2,
    private noticeService: NoticeService,
  ) {}

  /* ----------------------------------------------
     INIT: Load student, attendance, homework, etc.
  -----------------------------------------------*/
  ngOnInit(): void {
    this.username = (localStorage.getItem('username') || '').trim();
    if (!this.username) {
      this.attendanceError = 'No student name found';
      return;
    }

    // Default filter range: last 7 days
    this.toDate = this.today();
    this.fromDate = this.shiftDays(-7);

    // Step 1 — Get Student Record
    this.loadStudentByName();
  }

  /* ----------------------------------------------
     SIDEBAR TOGGLE (MOBILE + DESKTOP)
  -----------------------------------------------*/
  toggleStudentSidebar() {
    const sidebar = this.studentSidebar.nativeElement;
    const main = this.studentMainContent.nativeElement;

    // Mobile drawer
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
      return;
    }

    // Desktop collapse mode
    if (sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
      main.classList.remove('expanded');
    } else {
      sidebar.classList.add('collapsed');
      main.classList.add('expanded');
    }
  }

  selectTab(tab: string) {
    this.activeTab = tab;
  }

  /* ----------------------------------------------
       LOAD STUDENT
  -----------------------------------------------*/
  private loadStudentByName() {
    this.studentService
      .searchStudentsByName(this.username)
      .pipe(catchError(() => of([])))
      .subscribe((students) => {
        if (!students.length) {
          this.attendanceError = 'Student not found';
          return;
        }

        this.student = students[0];
        this.classTeacherName = this.student.classteacher ?? '—';

        // Convert studentId to number
        const idVal = Number(this.student.studentId);
        if (!idVal || isNaN(idVal)) {
          this.attendanceError = 'Invalid studentId';
          return;
        }
        this.studentId = idVal;

        // Load dependent data
        this.loadAttendanceByStudentName(this.username);
        this.loadNoticesForStudent();
        this.loadMyProgress();
      });
  }

  /* ----------------------------------------------
     NOTICES
  -----------------------------------------------*/
  private loadNoticesForStudent() {
    const teacher = this.student?.classteacher ?? '';

    if (!teacher) return;

    this.noticeService.getNoticesByClassTeacher(teacher)
      .pipe(catchError(() => of([])))
      .subscribe((list) => {
        this.notices = (list || []).map((n: any) => ({
          _id: n._id,
          Noticeid: n.Noticeid,
          name: n.name,
          class: n.class ?? '',
          role: n.Role ?? '',
          title: n.title ?? n.Notice ?? 'Notice',
          message: n.message ?? n.Notice ?? '',
          classteacher: n.classteacher ?? teacher,
        }));
      });
  }

  /* ----------------------------------------------
      ATTENDANCE
  -----------------------------------------------*/
  loadAttendanceByStudentName(name: string, weeks: number = 1) {
    this.loadingAttendance = true;

    this.attendanceService.getAttendanceByStudentName(name, weeks)
      .pipe(
        catchError(() => of(null)),
        finalize(() => (this.loadingAttendance = false))
      )
      .subscribe((resp) => {
        if (!resp) {
          this.attendanceRecords = [];
          this.weeklyAttendance = [];
          return;
        }

        this.weeklyAttendance = resp.weeks ?? [];
        this.attendanceRecords = this.weeklyAttendance.flatMap(w => w.records || []);

        this.attendanceSummary = this.summarizeAttendance(this.attendanceRecords);
        this.calculateAttendancePercent();
      });
  }

  summarizeAttendance(records: Attendance[]): string {
    if (!records.length) return 'No attendance records';

    const present = records.filter(r => r.status === 'Present').length;
    const absent = records.filter(r => r.status === 'Absent').length;
    const leave = records.filter(r => r.status === 'Leave').length;

    return `Present: ${present}, Absent: ${absent}, Leave: ${leave}`;
  }

  private calculateAttendancePercent() {
    if (!this.attendanceRecords.length) {
      this.attendancePercent = 0;
      return;
    }

    const present = this.attendanceRecords.filter(r => r.status === 'Present').length;
    this.attendancePercent = Math.round((present / this.attendanceRecords.length) * 100);
  }

  /* ----------------------------------------------
      HOMEWORK / PROGRESS
  -----------------------------------------------*/
  loadMyProgress() {
    if (!this.studentId) return;

    this.loading = true;

    this.progressService
      .getProgressByStudent(this.studentId, {
        fromDate: this.fromDate,
        toDate: this.toDate,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (list) => {
          this.myProgressList = this.applySubjectFilter(list || []);
          this.remarkMap = {};

          this.myProgressList.forEach(p => {
            if (p._id) this.remarkMap[p._id] = p.studentRemark || '';
          });

          this.calculateHomeworkDonePercent();
        },
        error: () => (this.message = 'Failed to load homework'),
      });
  }

  private applySubjectFilter(list: StudentProgress[]) {
    if (!this.subjectFilter) return list;

    const s = this.subjectFilter.toLowerCase();
    return list.filter(p => p.subject?.toLowerCase().includes(s));
  }

  private calculateHomeworkDonePercent() {
    if (!this.myProgressList.length) {
      this.homeworkDonePercent = 0;
      return;
    }

    const done = this.myProgressList.filter(p => p.status === 'Completed').length;
    this.homeworkDonePercent = Math.round((done / this.myProgressList.length) * 100);
  }

  markHomeworkDone(p: StudentProgress) {
    if (!p._id) return;

    const remark = (this.remarkMap[p._id] || '').trim();

    const payload: Partial<StudentProgress> = {
      status: 'Completed',
      studentRemark: remark || 'Done',
      studentRemarkDate: this.today(),
    };

    this.loading = true;

    this.progressService.updateProgress(p._id, payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (updated) => {
          Object.assign(p, updated);
          this.calculateHomeworkDonePercent();
          this.message = 'Marked as done!';
        },
        error: () => alert('Failed to update homework'),
      });
  }

  /* ----------------------------------------------
      UTILITIES
  -----------------------------------------------*/
  private today(): string {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  }

  private shiftDays(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  }
}
