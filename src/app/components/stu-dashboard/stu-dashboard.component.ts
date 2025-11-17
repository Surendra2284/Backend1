import { Component, OnInit } from '@angular/core';
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
  student: any = null;

  // Attendance
  attendanceRecords: Attendance[] = [];
  weeklyAttendance: WeekAttendance[] = [];
  attendanceSummary = '';
  attendanceError = '';
  loadingAttendance = false;

  // Notices
  classTeacherName = '';
  notices: any[] = [];

  // Auth / identity
  username = '';

  // studentId is numeric (for getProgressByStudent)
  studentId: number = 0;

  // Tabs
  activeTab: string = 'homework';

  // Progress / homework
  myProgressList: StudentProgress[] = [];
  remarkMap: { [id: string]: string } = {};

  // Filters
  fromDate: string = '';
  toDate: string = '';
  subjectFilter: string = '';

  // UI state
  loading = false;
  message = '';

  constructor(
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private progressService: StudentProgressService,
    private noticeService: NoticeService,
  ) {}

  ngOnInit(): void {
    const storedName = (localStorage.getItem('username') || '').trim();
    this.username = storedName;

    if (!storedName) {
      console.warn('No student name found in localStorage');
      this.attendanceError = 'No student name available';
      return;
    }

    // Default range: last 7 days
    this.toDate = this.today();
    this.fromDate = this.shiftDays(-7);

    // 1) Find student by username (this is the ONLY way to get studentId)
    this.studentService
      .searchStudentsByName(storedName)
      .pipe(
        catchError((err) => {
          console.warn('searchStudentsByName failed:', err);
          return of([] as any[]);
        })
      )
      .subscribe((students) => {
        if (!students || students.length === 0) {
          console.warn('No student found for name:', storedName);
          this.attendanceError = 'Student record not found';
          return;
        }

        // Use first matched student
        this.student = students[0];
        this.classTeacherName = this.student.classteacher ?? '—';

        // ✅ Get numeric studentId safely
        const rawId = this.student.studentId;
        const parsedId =
          typeof rawId === 'string' ? parseInt(rawId, 10) : Number(rawId);

        if (!parsedId || isNaN(parsedId)) {
          console.error('Student found but has invalid numeric studentId:', rawId);
          this.attendanceError = 'Student ID not available for this record';
          return;
        }

        this.studentId = parsedId;

        // 2) Load attendance for this student
        this.loadAttendanceByStudentName(storedName, 1);

        // 3) Load notices for this student's class/teacher
        this.loadNoticesForStudent();

        // 4) Load progress / homework AFTER studentId is known
        this.loadMyProgress();
      });
  }

  /** Load notices logic */
  private loadNoticesForStudent() {
    const studentClass = (this.student?.class ?? '').toString();
    const studentClassteacher = (this.student?.classteacher ?? '').toString();

    if (!studentClass || !studentClassteacher) {
      return;
    }

    this.noticeService
      .getNoticesByClassTeacher(studentClassteacher)
      .pipe(
        catchError((err) => {
          console.error('Error fetching notices by classTeacherName:', err);
          return of([] as any[]);
        })
      )
      .subscribe((noticesFromApi) => {
        this.notices = (Array.isArray(noticesFromApi)
          ? noticesFromApi
          : []
        ).map((n: any) => ({
          _id: n._id,
          Noticeid: n.Noticeid,
          name: n.name,
          class: n.class ?? n.className ?? '',
          role: n.Role ?? n.role ?? '',
          title: n.title ?? n.Notice ?? n.name ?? 'Notice',
          message: n.message ?? n.Notice ?? n.description ?? '',
          classteacher: n.classteacher ?? this.classTeacherName,
          isApproved: n.isApproved ?? false,
          createdAt: n.createdAt ?? n.created_at ?? null,
        }));
      });
  }

  selectTab(tab: string) {
    this.activeTab = tab;
  }

  loadAttendanceByStudentName(name: string, weeks: number = 1) {
    this.loadingAttendance = true;
    this.attendanceError = '';

    this.attendanceService
      .getAttendanceByStudentName(name, weeks)
      .pipe(
        catchError((err) => {
          console.error('Error loading attendance by student name:', err);
          this.attendanceError = err?.message || 'Failed to load attendance';
          return of(null as StudentAttendanceByNameResponse | null);
        }),
        finalize(() => (this.loadingAttendance = false))
      )
      .subscribe((resp) => {
        if (!resp) {
          this.weeklyAttendance = [];
          this.attendanceRecords = [];
          this.attendanceSummary = 'No attendance data';
          return;
        }

        this.student = resp.student ?? this.student;
        this.weeklyAttendance = resp.weeks ?? [];

        this.attendanceRecords = this.weeklyAttendance.flatMap((w) =>
          Array.isArray(w.records) ? w.records : []
        );

        this.attendanceSummary = this.summarizeAttendance(
          this.attendanceRecords
        );
      });
  }

  summarizeAttendance(records: Attendance[] | undefined): string {
    if (!records || !Array.isArray(records) || records.length === 0) {
      return 'No attendance records';
    }

    const present = records.filter((r) => r.status === 'Present').length;
    const absent = records.filter((r) => r.status === 'Absent').length;
    const leave = records.filter((r) => r.status === 'Leave').length;

    return `Present: ${present}, Absent: ${absent}, Leave: ${leave}`;
  }

  trackByWeek(_: number, item: WeekAttendance) {
    return (item.weekStart ?? '') + '|' + (item.weekEnd ?? '');
  }

  trackByRecord(_: number, item: any) {
    return item._id ?? item.date;
  }

  loadMyProgress() {
    if (!this.studentId) {
      console.warn('loadMyProgress called without studentId');
      return;
    }

    this.loading = true;
    this.message = '';

    this.progressService
      .getProgressByStudent(this.studentId, {
        fromDate: this.fromDate || undefined,
        toDate: this.toDate || undefined,
      })
      .subscribe({
        next: (list) => {
          // Optional subject filter
          if (this.subjectFilter) {
            this.myProgressList = (list || []).filter(
              (p) =>
                p.subject &&
                p.subject
                  .toLowerCase()
                  .includes(this.subjectFilter.toLowerCase())
            );
          } else {
            this.myProgressList = list || [];
          }

          // Initialize remark map
          this.remarkMap = {};
          this.myProgressList.forEach((p) => {
            if (p._id) {
              this.remarkMap[p._id] = p.studentRemark || '';
            }
          });

          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading student progress:', err);
          this.message = 'Failed to load homework/progress.';
          this.loading = false;
        },
      });
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

    this.progressService.updateProgress(p._id, payload).subscribe({
      next: (updated) => {
        const idx = this.myProgressList.findIndex((x) => x._id === p._id);
        if (idx >= 0) {
          this.myProgressList[idx] = {
            ...this.myProgressList[idx],
            ...updated,
          };
        }
        this.message = 'Marked as done!';
        this.loading = false;
      },
      error: (err) => {
        console.error('Error updating homework:', err);
        alert('Failed to update homework status.');
        this.loading = false;
      },
    });
  }

  private today(): string {
    const d = new Date();
    const localISO = new Date(
      d.getTime() - d.getTimezoneOffset() * 60000
    ).toISOString();
    return localISO.slice(0, 10);
  }

  private shiftDays(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const localISO = new Date(
      d.getTime() - d.getTimezoneOffset() * 60000
    ).toISOString();
    return localISO.slice(0, 10);
  }
}
