import { Component, OnInit } from '@angular/core';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { TeacherService } from '../../services/teacher.service';
import { StudentService } from '../../services/student.service';
import {
  AttendanceService,
  Attendance,
  WeekAttendance,
  StudentAttendanceByNameResponse
} from '../../services/attendance.service';
import { NoticeService } from '../../services/notice.service';

@Component({
  selector: 'app-stu-dashboard',
  templateUrl: './stu-dashboard.component.html',
  styleUrls: ['./stu-dashboard.component.css']
})
export class StuDashboardComponent implements OnInit {
  student: any = null;
  attendanceRecords: Attendance[] = []; // fallback flat array if you still need it
  weeklyAttendance: WeekAttendance[] = []; // grouped by week (from backend)
  attendanceSummary = '';
  classTeacherName = '';
  notices: any[] = [];

  // UX state
  loadingAttendance = false;
  attendanceError = '';

  constructor(
    private teacherService: TeacherService,
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private noticeService: NoticeService
  ) {}

  ngOnInit(): void {
    const storedName = (localStorage.getItem('username') || '').trim();

    if (!storedName) {
      console.warn('No student name found in localStorage');
      this.attendanceError = 'No student name available';
      return;
    }

    // 1) Try to fetch student metadata (optional, non-blocking)
    this.studentService.searchStudentsByName(storedName).pipe(
      catchError(err => {
        console.warn('searchStudentsByName failed (continuing):', err);
        return of([] as any[]);
      })
    ).subscribe((students) => {
      if (students && students.length > 0) {
        this.student = students[0];
        this.classTeacherName = this.student.classteacher ?? '—';
      }
      // 2) Load weekly attendance (use backend endpoint that groups by week)
      this.loadAttendanceByStudentName(storedName, 1);
      // 3) Fetch notices if class available
      const studentClass = (this.student?.class ?? '').toString();
      const studentClassteacher = (this.student?.classteacher ?? '').toString();
      if (studentClass) {
        this.noticeService.getNoticesByClassTeacher(studentClassteacher).pipe(
          catchError(err => {
            console.error('Error fetching notices by classTeacherName:', err);
            return of([] as any[]);
          })
        ).subscribe((noticesFromApi) => {
          this.notices = (Array.isArray(noticesFromApi) ? noticesFromApi : []).map((n: any) => ({
            _id: n._id,
            Noticeid: n.Noticeid,
            name: n.name,
            class: n.class ?? n.className ?? '',
            role: n.Role ?? n.role ?? '',
            title: n.title ?? n.Notice ?? n.name ?? 'Notice',
            message: n.message ?? n.Notice ?? n.description ?? '',
            classteacher: n.classteacher ?? this.classTeacherName,
            isApproved: n.isApproved ?? false,
            createdAt: n.createdAt ?? n.created_at ?? null
          }));
        });
      } else {
        // If student metadata not present yet, try to fetch notices later when student is set
      }
    });
  }

  loadAttendanceByStudentName(name: string, weeks: number = 1) {
    this.loadingAttendance = true;
    this.attendanceError = '';

    this.attendanceService.getAttendanceByStudentName(name, weeks).pipe(
      catchError(err => {
        console.error('Error loading attendance by student name:', err);
        this.attendanceError = err?.message || 'Failed to load attendance';
        return of(null as StudentAttendanceByNameResponse | null);
      }),
      finalize(() => this.loadingAttendance = false)
    ).subscribe((resp) => {
      if (!resp) {
        this.weeklyAttendance = [];
        this.student = this.student ?? null;
        this.attendanceRecords = [];
        this.attendanceSummary = 'No attendance data';
        return;
      }

      // Backend returns student and weeks[]
      this.student = resp.student ?? this.student;
      this.weeklyAttendance = resp.weeks ?? [];

      // Flatten into attendanceRecords if you need a flat list
      this.attendanceRecords = this.weeklyAttendance.flatMap(w => Array.isArray(w.records) ? w.records : []);

      // compute summary across all returned records
      this.attendanceSummary = this.summarizeAttendance(this.attendanceRecords);
    });
  }

  summarizeAttendance(records: Attendance[] | undefined): string {
    if (!records || !Array.isArray(records) || records.length === 0) {
      return 'No attendance records';
    }

    const present = records.filter(r => r.status === 'Present').length;
    const absent = records.filter(r => r.status === 'Absent').length;
    const leave = records.filter(r => r.status === 'Leave').length;

    return `Present: ${present}, Absent: ${absent}, Leave: ${leave}`;
  }

  // helpers for *ngFor trackBy
  trackByWeek(_: number, item: WeekAttendance) {
    return (item.weekStart ?? '') + '|' + (item.weekEnd ?? '');
  }

  trackByRecord(_: number, item: any) {
    return item._id ?? item.date;
  }
}
