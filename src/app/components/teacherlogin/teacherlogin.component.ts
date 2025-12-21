import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { StudentService, Student } from '../../services/student.service';
import { NoticeService, Notice } from '../../services/notice.service';
import {
  AttendanceService,
  Attendance,
  AttStatus,
} from '../../services/attendance.service';
import { TeacherService } from '../../services/teacher.service';
import { Teacher } from '../../components/models/Teacher';
import {
  StudentProgressService,
  ProgressStatus,
  BulkProgressPayload,
  StudentProgress,
} from '../../services/student-progress.service';

import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-teacherlogin',
  
  templateUrl: './teacherlogin.component.html',
  styleUrls: ['./teacherlogin.component.scss'],
})
export class TeacherloginComponent implements OnInit {
  // Tabs: 'students' | 'attendance' | 'notices' | 'progress'
  activeTab: string = 'students';
  sidebarOpen: boolean = false;

isMobile = false;
  // Logged-in teacher data
  loggedInTeacher: Teacher | null = null;
  displayName: string = '';

  // Students & notices
  students: Student[] = [];
  teacherNotices: Notice[] = [];
  newNotice: Partial<Notice> = { Notice: '' };

  /** UI attendance state: keyed by Student.studentId (number) */
  attendance: { [studentId: number]: AttStatus } = {};
  attendanceRecords: Attendance[] = [];

  // ========== Student Progress (Homework) ==========

  /** Filter date for CURRENT homework (for editing/creating one homework set) */
  progressDate: string = this.today(); // YYYY-MM-DD

  /** Subject filter / current subject for new homework */
  progressSubject: string = '';

  /** Homework text for this class/date/subject (current) */
  homeworkText: string = '';

  /**
   * Per-student in-memory progress state for the CURRENT date+subject
   * (used for the "New / Current Homework" block and the "Current homework table").
   */
  progressMap: {
    [studentId: number]: {
      status: ProgressStatus;
      progressNote: string;
      score?: number;
      _id?: string; // existing record id (for delete/update)
      studentRemark?: string;
      studentRemarkDate?: string;
      studentName?: string;
    };
  } = {};

  /** Which students will receive the CURRENT homework when saving */
  selectedForCurrentHomework: { [studentId: number]: boolean } = {};

  /** FULL history list returned from backend (all dates / all subjects) */
  classProgressList: StudentProgress[] = [];

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

  /* -------------------------------------------------------------------------- */
  /*  Lifecycle                                                                 */
  /* -------------------------------------------------------------------------- */

  ngOnInit(): void {
    this.checkScreen();
  window.addEventListener('resize', () => this.checkScreen());
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
          this.loadClassProgress(); // load current + history
        } else {
          console.warn('Teacher has no assigned class.');
        }
      },
      error: (err) => {
        console.error('Failed to load teacher:', err);
        alert('Unable to load teacher information. Please try again.');
      },
    });
  }
  checkScreen() {
  this.isMobile = window.innerWidth <= 768;

  // Auto-close sidebar on mobile
  }
toggleTeacherSidebar() {
  this.sidebarOpen = !this.sidebarOpen;
}

  selectTab(tab: string) {
    this.activeTab = tab;

    if (tab === 'progress') {
      this.loadClassProgress();
    }
  }

  /* -------------------------------------------------------------------------- */
  /*  Students                                                                  */
  /* -------------------------------------------------------------------------- */

  loadStudents(): void {
    const className = this.loggedInTeacher?.Assignclass;
    if (!className) {
      console.warn('No class assigned to teacher. Cannot load students.');
      return;
    }

    this.studentService.searchStudentsByClass(className).subscribe({
      next: (students) => {
        this.students = (students || []).filter((s) => s.class === className);

        // Initialize default attendance ('Absent') where not set
        this.students.forEach((stu) => {
          if (!Object.prototype.hasOwnProperty.call(this.attendance, stu.studentId)) {
            this.attendance[stu.studentId] = 'Absent';
          }
        });

        // Initialize progressMap & selection defaults for each student
        this.students.forEach((stu) => {
          if (!this.progressMap[stu.studentId]) {
            this.progressMap[stu.studentId] = {
              status: 'Not Started',
              progressNote: '',
            };
          }
          if (this.selectedForCurrentHomework[stu.studentId] === undefined) {
            this.selectedForCurrentHomework[stu.studentId] = true; // default: selected
          }
        });
      },
      error: (err) => console.error('Error loading students:', err),
    });
  }
scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  this.sidebarOpen = false; // auto-close on mobile
}

  editStudent(student: Student) {
    const newName = prompt('Edit name:', student.name);
    if (newName === null) return;

    const updated = { ...student, name: newName || student.name };
    this.studentService.updateStudent(student.studentId, updated).subscribe({
      next: () => this.loadStudents(),
      error: (err) => console.error('Error updating student:', err),
    });
  }

  deleteStudent(studentId: number) {
    if (!confirm('Are you sure you want to delete this student?')) return;
    this.studentService.deleteStudent(studentId).subscribe({
      next: () => this.loadStudents(),
      error: (err) => console.error('Error deleting student:', err),
    });
  }

  /* -------------------------------------------------------------------------- */
  /*  Notices                                                                   */
  /* -------------------------------------------------------------------------- */

  loadNotices() {
    // Using teacher name as classteacher identifier
    this.noticeService.getNoticesByClassTeacher(this.displayName).subscribe({
      next: (data) => (this.teacherNotices = data || []),
      error: (err) => console.error('Error loading notices:', err),
    });
  }

  addNotice() {
    if (!this.loggedInTeacher?.Assignclass) {
      alert('No class assigned to teacher — cannot post a notice.');
      return;
    }

    const text = (this.newNotice.Notice || '').trim();
    if (!text) {
      alert('Please enter a notice message.');
      return;
    }

    const notice: Notice = {
      Noticeid: Date.now().toString(),
      name: this.displayName,
      class: this.loggedInTeacher.Assignclass,
      Role: 'Teacher',
      Notice: text,
      classteacher: this.displayName,
    };

    this.noticeService.addNotice(notice).subscribe({
      next: () => {
        this.newNotice = { Notice: '' };
        this.loadNotices();
      },
      error: (err) => console.error('Error posting notice:', err),
    });
  }

  editNotice(notice: Notice) {
    const updatedText = prompt('Edit notice:', notice.Notice);
    if (updatedText === null) return;

    const updated = { ...notice, Notice: updatedText || notice.Notice };
    this.noticeService.editNotice(notice._id!, updated).subscribe({
      next: () => this.loadNotices(),
      error: (err) => console.error('Error editing notice:', err),
    });
  }

  deleteNotice(id: string) {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    this.noticeService.deleteNotice(id).subscribe({
      next: () => this.loadNotices(),
      error: (err) => console.error('Error deleting notice:', err),
    });
  }

  /* -------------------------------------------------------------------------- */
  /*  Attendance                                                                */
  /* -------------------------------------------------------------------------- */

  loadAttendance() {
    const className = this.loggedInTeacher?.Assignclass;
    if (!className) return;

    this.attendanceService
      .getAttendanceListOnly({ className, page: 1, limit: 500 })
      .subscribe({
        next: (list) => {
          this.attendanceRecords = list || [];

          // Build latest status per studentId
          const latestPerStudent = new Map<number, AttStatus>();
          this.attendanceRecords.forEach((r) => {
            const sid = r.studentId;
            if (typeof sid === 'number' && !latestPerStudent.has(sid)) {
              latestPerStudent.set(sid, r.status as AttStatus);
            }
          });

          // Seed UI with latest values
          this.students.forEach((stu) => {
            const v = latestPerStudent.get(stu.studentId);
            if (v) this.attendance[stu.studentId] = v;
          });
        },
        error: (err) => console.error('Error loading attendance:', err),
      });
  }

  markAll(status: AttStatus) {
    this.students.forEach((s) => {
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
    const username =
      localStorage.getItem('username') || this.displayName || 'teacher';
    const date = this.today();

    const presentIds: (string | number)[] = [];
    const absentIds: (string | number)[] = [];
    const leaveIds: (string | number)[] = [];

    this.students.forEach((s) => {
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

        const presentToSave = presentIds.filter((id) => !existingSet.has(Number(id)));
        const absentToSave = absentIds.filter((id) => !existingSet.has(Number(id)));
        const leaveToSave = leaveIds.filter((id) => !existingSet.has(Number(id)));

        const presentExisting = presentIds.length - presentToSave.length;
        const absentExisting = absentIds.length - absentToSave.length;
        const leaveExisting = leaveIds.length - leaveToSave.length;
        const totalExisting = presentExisting + absentExisting + leaveExisting;

        const buildCalls = (
          pIds: (string | number)[],
          aIds: (string | number)[],
          lIds: (string | number)[]
        ) => {
          const calls = [];
          if (pIds.length)
            calls.push(
              this.attendanceService.saveAttendanceBulk({
                studentIds: pIds,
                className,
                teacher,
                username,
                date,
                status: 'Present',
              })
            );
          if (aIds.length)
            calls.push(
              this.attendanceService.saveAttendanceBulk({
                studentIds: aIds,
                className,
                teacher,
                username,
                date,
                status: 'Absent',
              })
            );
          if (lIds.length)
            calls.push(
              this.attendanceService.saveAttendanceBulk({
                studentIds: lIds,
                className,
                teacher,
                username,
                date,
                status: 'Leave',
              })
            );
          return calls;
        };

        // Case 1: everything already exists
        if (
          presentToSave.length + absentToSave.length + leaveToSave.length ===
          0
        ) {
          if (totalExisting === 0) {
            this.loading = false;
            alert('Nothing to save.');
            return;
          }

          const ok = confirm(
            `${totalExisting} students already have attendance for ${date}. Press OK to overwrite those records, or Cancel to do nothing.`
          );
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
            },
          });
          return;
        }

        // Case 2: mix of existing + new
        if (totalExisting > 0) {
          const ok = confirm(
            `${totalExisting} students already have attendance for ${date}. Press OK to overwrite them as well, or Cancel to only save for remaining ${
              presentToSave.length + absentToSave.length + leaveToSave.length
            } students.`
          );
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
              },
            });
            return;
          }
        }

        // Case 3: only new records to save
        const calls = buildCalls(presentToSave, absentToSave, leaveToSave);
        if (!calls.length) {
          this.loading = false;
          alert('No new attendance to save.');
          return;
        }

        forkJoin(calls).subscribe({
          next: () => {
            this.loading = false;
            const savedCount =
              presentToSave.length + absentToSave.length + leaveToSave.length;
            const skipped = totalExisting;
            alert(
              `Attendance saved for ${savedCount} students. Skipped ${skipped} already-recorded students.`
            );
            this.loadAttendance();
          },
          error: (err) => {
            this.loading = false;
            console.error('Error saving attendance:', err);
            alert('Failed to save attendance.');
          },
        });
      },
      error: (err) => {
        this.loading = false;
        console.error('Error checking existing attendance:', err);
        alert('Could not verify existing attendance; aborting save.');
      },
    });
  }

  /* -------------------------------------------------------------------------- */
  /*  Student Progress (Homework)                                              */
  /* -------------------------------------------------------------------------- */

  /**
   * Load:
   *  1) CURRENT homework for given date+subject (for creating/updating one set)
   *  2) FULL history (all dates & subjects) for this class
   */
  loadClassProgress() {
    const className = this.loggedInTeacher?.Assignclass;
    if (!className) return;

    const dateFilter = this.progressDate || undefined;
    const subjectFilter = this.progressSubject || undefined;

    // 1) Load CURRENT homework set (date + subject)
    this.studentProgressService
      .getProgressByClass({
        className,
        date: dateFilter,
        subject: subjectFilter,
      })
      .subscribe({
        next: (list) => {
          // Reset current map for all students
          this.students.forEach((s) => {
            this.progressMap[s.studentId] = {
              status: 'Not Started',
              progressNote: '',
              score: undefined,
              _id: undefined,
              studentRemark: undefined,
              studentRemarkDate: undefined,
            };
          });

          // If we have an existing homework set for this date+subject, load it
          if (list && list.length > 0) {
            const first = list[0];
            if (first.homework) {
              this.homeworkText = first.homework;
            }
            if (first.subject && !this.progressSubject) {
              this.progressSubject = first.subject;
            }

            list.forEach((p) => {
              const sid = p.studentId;
              if (!sid) return;

              this.progressMap[sid] = {
                status: p.status || 'Not Started',
                progressNote: p.progressNote || '',
                score: p.score,
                _id: p._id,
                studentRemark: p.studentRemark,
                studentRemarkDate: p.studentRemarkDate,
              };
            });
          } else {
            // If no existing homework set -> clear homework text for new one
            this.homeworkText = '';
          }

          // Ensure selection map is defined for all students
          this.students.forEach((s) => {
            if (this.selectedForCurrentHomework[s.studentId] === undefined) {
              this.selectedForCurrentHomework[s.studentId] = true;
            }
          });
        },
        error: (err) => {
          console.error('Error loading current class progress:', err);
        },
      });

    // 2) Load FULL history (no date / subject filter)
    this.studentProgressService
      .getProgressByClass({ className })
      .subscribe({
        next: (all) => {
          this.classProgressList = all || [];
        },
        error: (err) => {
          console.error('Error loading full progress history:', err);
        },
      });
  }

  /** Teacher marks same status for all students at once (CURRENT homework) */
  markAllProgress(status: ProgressStatus) {
    this.students.forEach((s) => {
      if (!this.progressMap[s.studentId]) {
        this.progressMap[s.studentId] = {
          status,
          progressNote: '',
        };
      } else {
        this.progressMap[s.studentId].status = status;
      }
    });
  }

  /** Save (bulk upsert) progress for selected students only */
  saveClassProgress() {
    if (!this.loggedInTeacher?.Assignclass) {
      alert('No class assigned to teacher.');
      return;
    }

    if (!this.progressSubject.trim()) {
      alert('Please enter subject for homework.');
      return;
    }

    if (!this.homeworkText.trim()) {
      alert('Please enter homework text.');
      return;
    }

    const className = this.loggedInTeacher.Assignclass;
    const teacher = this.displayName || 'Teacher';
    const username =
      localStorage.getItem('username') || this.displayName || 'teacher';
    const date = this.progressDate || this.today();

    const selectedStudents = this.students.filter(
      (s) => this.selectedForCurrentHomework[s.studentId] !== false
    );

    if (!selectedStudents.length) {
      alert('Please select at least one student for this homework.');
      return;
    }

    const entries = selectedStudents.map(
  (s): BulkProgressPayload['entries'][number] => {
    const p = this.progressMap[s.studentId] || {
      status: 'Not Started' as ProgressStatus,
      progressNote: '',
    };

    return {
      studentId: s.studentId,
      
      progressNote: p.progressNote || '',
      status: p.status || 'Not Started',
      score: typeof p.score === 'number' ? p.score : undefined,
    };
  }
);


    this.loading = true;

    const payload: BulkProgressPayload = {
      className,
      subject: this.progressSubject,
      date,
      homework: this.homeworkText,
      teacher,
      username,
      entries,
    };

    this.studentProgressService.saveBulkProgress(payload).subscribe({
      next: () => {
        this.loading = false;
        alert('Homework & student progress saved successfully.');
        this.loadClassProgress(); // reload current + history
      },
      error: (err) => {
        this.loading = false;
        console.error('Error saving student progress:', err);
        alert('Failed to save student progress.');
      },
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
      },
    });
  }

  /* -------------------------------------------------------------------------- */
  /*  Helpers                                                                   */
  /* -------------------------------------------------------------------------- */

  private normalizeStatus(val: any): AttStatus {
    const map: Record<string, AttStatus> = {
      present: 'Present',
      absent: 'Absent',
      leave: 'Leave',
      late: 'Leave',
    };
    return map[String(val || '').toLowerCase()] ?? 'Present';
  }

  /** Return ALL homework/progress entries for a given studentId (all subjects, all dates) */
  getProgressForStudent(studentId: number) {
    if (!this.classProgressList || !this.classProgressList.length) {
      return [];
    }
    return this.classProgressList.filter((p) => p.studentId === studentId);
  }

  logout() {
    localStorage.removeItem('username');
    alert('Logged out successfully!');
  }
getStudentNameById(studentId: number): string {
  const s = this.students.find(stu => stu.studentId === studentId);
  return s ? s.name : 'Unknown';
}

  private today(): string {
    const d = new Date();
    const localISO = new Date(
      d.getTime() - d.getTimezoneOffset() * 60000
    ).toISOString();
    return localISO.slice(0, 10);
  }
}
