import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { StudentService, Student } from '../../services/student.service';
import { NoticeService, Notice } from '../../services/notice.service';
import { AttendanceService, Attendance, AttStatus } from '../../services/attendance.service';
import { TeacherService } from '../../services/teacher.service';
import { Teacher } from '../../components/models/Teacher';
import { StudentProgressService, ProgressStatus, BulkProgressPayload, StudentProgress } from '../../services/student-progress.service';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-teacherlogin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacherlogin.component.html',
  styleUrls: ['./teacherlogin.component.css']
})
export class TeacherloginComponent implements OnInit {
  activeTab: string = 'students'; // 'students' | 'notices' | 'attendance' | 'progress'
  loggedInTeacher: Teacher | null = null;
  displayName: string = '';

  students: Student[] = [];
  teacherNotices: Notice[] = [];
  newNotice: Partial<Notice> = { Notice: '' };

  /** UI attendance state: keyed by Student.studentId (number) */
  attendance: { [studentId: number]: AttStatus } = {};

  attendanceRecords: Attendance[] = [];

  // ========== Student Progress (Homework) ==========
  progressDate: string = this.today();     // YYYY-MM-DD
  progressSubject: string = '';
  homeworkText: string = '';

  // Per-student progress fields
  progressMap: {
    [studentId: number]: {
      status: ProgressStatus;
      progressNote: string;
      score?: number;
      _id?: string; // existing record id (for update/delete if needed)
    };
  } = {};

  classProgressList: StudentProgress[] = []; // loaded from backend for class & date

  // UI helpers
  message = '';
  loading = false;

  constructor(
    private studentService: StudentService,
    private noticeService: NoticeService,
    private attendanceService: AttendanceService,
    private teacherService: TeacherService,
    private studentProgressService: StudentProgressService
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
          this.loadClassProgress(); // load progress for today by default
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

    if (tab === 'progress') {
      this.loadClassProgress();
    }
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

        // Initialize progress map defaults
        this.students.forEach(stu => {
          if (!this.progressMap[stu.studentId]) {
            this.progressMap[stu.studentId] = {
              status: 'Not Started',
              progressNote: '',
            };
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

    this.attendanceService.getAttendanceListOnly({ className, page: 1, limit: 500 }).subscribe({
      next: (list) => {
        this.attendanceRecords = list || [];

        // Build latest status per studentId (records should be sorted desc by date in API)
        const latestPerStudent = new Map<number, AttStatus>();
        this.attendanceRecords.forEach(r => {
          const sid = r.studentId;
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

  markAll(status: AttStatus) {
    this.students.forEach(s => {
      this.attendance[s.studentId] = status;
    });
  }

  saveAttendance() {
    if (!this.loggedInTeacher?.Assignclass) {
      alert('No class assigned to teacher.');
      return;
    }

    const className = this.loggedInTeacher.Assignclass;
    const teacher = this.displayName || 'Teacher';
    const username = localStorage.getItem('username') || this.displayName || 'teacher';
    const date = this.today(); // YYYY-MM-DD

    const presentIds: (string | number)[] = [];
    const absentIds: (string | number)[]  = [];
    const leaveIds: (string | number)[]   = [];

    this.students.forEach(s => {
      const sid = s.studentId;
      const status = this.normalizeStatus(this.attendance[sid] || 'Absent');

      if (status === 'Present') presentIds.push(sid);
      else if (status === 'Leave') leaveIds.push(sid);
      else absentIds.push(sid);
    });

    if (presentIds.length + absentIds.length + leaveIds.length === 0) {
      alert('No students found to save attendance for.');
      return;
    }

    this.loading = true;

    this.attendanceService.getAttendanceArray({ className, date }).subscribe({
      next: (existingRecords) => {
        const existingSet = new Set<number>();
        (existingRecords || []).forEach((r: Attendance) => {
          if (typeof r.studentId === 'number') {
            existingSet.add(r.studentId);
          }
        });

        const presentToSave = presentIds.filter(id => !existingSet.has(Number(id)));
        const absentToSave  = absentIds.filter(id => !existingSet.has(Number(id)));
        const leaveToSave   = leaveIds.filter(id => !existingSet.has(Number(id)));

        const presentExisting = presentIds.length - presentToSave.length;
        const absentExisting  = absentIds.length - absentToSave.length;
        const leaveExisting   = leaveIds.length - leaveToSave.length;

        const totalExisting = presentExisting + absentExisting + leaveExisting;

        const buildCalls = (pIds: (string | number)[], aIds: (string | number)[], lIds: (string | number)[]) => {
          const calls = [];
          if (pIds.length) calls.push(this.attendanceService.saveAttendanceBulk({
            studentIds: pIds, className, teacher, username, date, status: 'Present'
          }));
          if (aIds.length) calls.push(this.attendanceService.saveAttendanceBulk({
            studentIds: aIds, className, teacher, username, date, status: 'Absent'
          }));
          if (lIds.length) calls.push(this.attendanceService.saveAttendanceBulk({
            studentIds: lIds, className, teacher, username, date, status: 'Leave'
          }));
          return calls;
        };

        if (presentToSave.length + absentToSave.length + leaveToSave.length === 0) {
          if (totalExisting === 0) {
            this.loading = false;
            alert('Nothing to save.');
            return;
          }

          const ok = confirm(`${totalExisting} students already have attendance for ${date}. Press OK to overwrite those records, or Cancel to do nothing.`);
          if (!ok) {
            this.loading = false;
            return;
          }

          const calls = buildCalls(presentIds, absentIds, leaveIds);
          forkJoin(calls.length ? calls : [of(null)]).subscribe({
            next: () => {
              this.loading = false;
              alert('Attendance upserted (overwritten) successfully.');
              this.loadAttendance();
            },
            error: (err) => {
              this.loading = false;
              console.error('Error saving attendance:', err);
              alert('Failed to save attendance.');
            }
          });
          return;
        }

        if (totalExisting > 0) {
          const ok = confirm(`${totalExisting} students already have attendance for ${date}. Press OK to overwrite them as well, or Cancel to only save for remaining ${presentToSave.length + absentToSave.length + leaveToSave.length} students.`);
          if (ok) {
            const calls = buildCalls(presentIds, absentIds, leaveIds);
            forkJoin(calls.length ? calls : [of(null)]).subscribe({
              next: () => {
                this.loading = false;
                alert('Attendance upserted (overwritten) successfully.');
                this.loadAttendance();
              },
              error: (err) => {
                this.loading = false;
                console.error('Error saving attendance:', err);
                alert('Failed to save attendance.');
              }
            });
            return;
          }
        }

        const calls = buildCalls(presentToSave, absentToSave, leaveToSave);
        if (!calls.length) {
          this.loading = false;
          alert('No new attendance to save.');
          return;
        }

        forkJoin(calls).subscribe({
          next: () => {
            this.loading = false;
            const savedCount = presentToSave.length + absentToSave.length + leaveToSave.length;
            const skipped = totalExisting;
            alert(`Attendance saved for ${savedCount} students. Skipped ${skipped} already-recorded students.`);
            this.loadAttendance();
          },
          error: (err) => {
            this.loading = false;
            console.error('Error saving attendance:', err);
            alert('Failed to save attendance.');
          }
        });
      },
      error: (err) => {
        this.loading = false;
        console.error('Error checking existing attendance:', err);
        alert('Could not verify existing attendance; aborting save.');
      }
    });
  }

  // ========== Student Progress (Homework) ==========

  /** Load class progress list for chosen date & subject */
  loadClassProgress() {
    const className = this.loggedInTeacher?.Assignclass;
    if (!className) return;

    this.studentProgressService.getProgressByClass({
      className,
      date: this.progressDate,
      subject: this.progressSubject || undefined
    }).subscribe({
      next: (list) => {
        this.classProgressList = list || [];

        // Merge into progressMap
        this.classProgressList.forEach(p => {
          const sid = p.studentId;
          if (!sid) return;
          if (!this.progressMap[sid]) {
            this.progressMap[sid] = {
              status: p.status || 'Not Started',
              progressNote: p.progressNote || '',
              score: p.score,
              _id: p._id
            };
          } else {
            this.progressMap[sid].status = p.status || this.progressMap[sid].status;
            this.progressMap[sid].progressNote = p.progressNote || this.progressMap[sid].progressNote;
            this.progressMap[sid].score = p.score ?? this.progressMap[sid].score;
            this.progressMap[sid]._id = p._id;
          }
        });
      },
      error: (err) => {
        console.error('Error loading class progress:', err);
      }
    });
  }

  /** Teacher marks status for all students at once */
  markAllProgress(status: ProgressStatus) {
    this.students.forEach(s => {
      if (!this.progressMap[s.studentId]) {
        this.progressMap[s.studentId] = {
          status,
          progressNote: ''
        };
      } else {
        this.progressMap[s.studentId].status = status;
      }
    });
  }

  /** Save (bulk upsert) progress for the whole class */
  saveClassProgress() {
    if (!this.loggedInTeacher?.Assignclass) {
      alert('No class assigned to teacher.');
      return;
    }

    if (!this.progressSubject) {
      alert('Please enter subject for homework.');
      return;
    }

    if (!this.homeworkText) {
      alert('Please enter homework text.');
      return;
    }

    const className = this.loggedInTeacher.Assignclass;
    const teacher = this.displayName || 'Teacher';
    const username = localStorage.getItem('username') || this.displayName || 'teacher';
    const date = this.progressDate || this.today();

    const entries = this.students.map((s): BulkProgressPayload['entries'][number] => {
      const p = this.progressMap[s.studentId] || {
        status: 'Not Started',
        progressNote: ''
      };

      return {
        studentId: s.studentId,
        progressNote: p.progressNote || '',
        status: p.status || 'Not Started',
        score: typeof p.score === 'number' ? p.score : undefined
      };
    });

    this.loading = true;

    const payload: BulkProgressPayload = {
      className,
      subject: this.progressSubject,
      date,
      homework: this.homeworkText,
      teacher,
      username,
      entries
    };

    this.studentProgressService.saveBulkProgress(payload).subscribe({
      next: () => {
        this.loading = false;
        alert('Homework & student progress saved successfully.');
        this.loadClassProgress();
      },
      error: (err) => {
        this.loading = false;
        console.error('Error saving student progress:', err);
        alert('Failed to save student progress.');
      }
    });
  }

  /** Delete a single progress record (from teacher side) */
  deleteProgressRecord(id: string | undefined) {
  if (!id) return;
  if (!confirm('Delete this progress record?')) return;

  this.studentProgressService.deleteProgress(id).subscribe({
      next: () => {
        alert('Progress record deleted.');
        this.loadClassProgress();
      },
      error: (err) => {
        console.error('Error deleting progress record:', err);
        alert('Failed to delete progress record.');
      }
    });
  }

  // ========== Session ==========
  logout() {
    localStorage.removeItem('username');
    alert('Logged out successfully!');
  }

  // ========== Helpers ==========
  private normalizeStatus(val: any): AttStatus {
    const map: Record<string, AttStatus> = {
      present: 'Present',
      absent: 'Absent',
      leave: 'Leave',
      late: 'Leave', // legacy -> map to Leave
    };
    return map[String(val || '').toLowerCase()] ?? 'Present';
  }

  private today(): string {
    const d = new Date();
    const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
    return localISO.slice(0, 10);
  }
}
