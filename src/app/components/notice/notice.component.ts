import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NoticeService, Notice } from '../../services/notice.service';
import { UserService} from '../../services/user.service';
import { StudentService} from '../../services/student.service';
@Component({
  selector: 'app-notice',
  templateUrl: './notice.component.html',
  styleUrls: ['./notice.component.css']
})
export class NoticeComponent implements OnInit {
  noticeForm: FormGroup;
  notices: Notice[] = [];
  unapprovedNotices: Notice[] = [];
  isEdit = false;
  currentNoticeId: string | null = null;
  lastNoticeid: string | null = null;
  roles = ['Admin', 'Student', 'Teacher', 'Principal'];
  teachers: string[] = [];
classList: string[] = [];


  constructor(private fb: FormBuilder, private noticeService: NoticeService,private userService: UserService,private studentService:StudentService) {
    this.noticeForm = this.fb.group({
      Noticeid: [{ value: '', disabled: true }, Validators.required], // readonly input
      name: ['', Validators.required],
      class: ['', Validators.required],
      Role: ['', Validators.required],
      Notice: [''],
      classteacher: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    const user = this.userService.getUserDetails();

  // Auto-fill the notice creator's name
  this.noticeForm.patchValue({
    name: user.username
  });
  this.loadClasses();
  this.loadTeachers();
    this.loadNotices();
    this.loadUnapprovedNotices();
  }

  // Load all notices (approved + unapproved)
  loadNotices(): void {
    this.noticeService.getNotices().subscribe((data: Notice[]) => {
      // Sort notices by Noticeid in descending order (latest first)
      const sorted = data.sort((a, b) => parseInt(b.Noticeid) - parseInt(a.Noticeid));
      this.notices = sorted;

      // Generate next Notice ID
      const ids = sorted.map(n => parseInt(n.Noticeid, 10)).filter(id => !isNaN(id));
      const maxId = ids.length > 0 ? Math.max(...ids) : 0;
      this.lastNoticeid = (maxId + 1).toString();

      if (!this.isEdit) {
        this.noticeForm.patchValue({ Noticeid: this.lastNoticeid });
      }
    });
  }


  // Load only unapproved notices
  loadUnapprovedNotices(): void {
    this.noticeService.getUnapprovedNotices().subscribe({
      next: (data: Notice[]) => {
        this.unapprovedNotices = data;
      },
      error: (err) => console.error('Error loading unapproved notices:', err)
    });
  }

  onSubmit(): void {
    if (this.noticeForm.invalid) {
      this.noticeForm.markAllAsTouched();
      return;
    }

    const noticeData: Notice = {
      ...this.noticeForm.getRawValue(), // include disabled fields like Noticeid
    };

    if (this.isEdit && this.currentNoticeId) {
      this.noticeService.editNotice(this.currentNoticeId, noticeData).subscribe(() => {
        this.loadNotices();
        this.loadUnapprovedNotices();
        this.resetForm();
      });
    } else {
      noticeData.Noticeid = this.lastNoticeid ?? '1';
      this.noticeService.addNotice(noticeData).subscribe(() => {
        this.loadNotices();
        this.loadUnapprovedNotices();
        this.resetForm();
      });
    }
  }

  editNotice(notice: Notice): void {
    this.isEdit = true;
    this.currentNoticeId = notice._id ?? null;
    this.noticeForm.patchValue(notice);
    this.noticeForm.get('Noticeid')?.disable(); // keep Noticeid readonly
  }

  deleteNotice(id: string): void {
    this.noticeService.deleteNotice(id).subscribe(() => {
      this.loadNotices();
      this.loadUnapprovedNotices();
    });
  }

  approveNotice(notice: Notice): void {
    if (!notice._id) return;
    this.noticeService.approveNotice(notice._id).subscribe(() => {
      this.loadNotices();
      this.loadUnapprovedNotices();
    });
  }

  resetForm(): void {
    this.noticeForm.reset();
    this.isEdit = false;
    this.currentNoticeId = null;
    this.loadNotices(); // regenerate new Noticeid
  }

  filterNoticesByClassTeacher(classteacher: string): void {
    this.noticeService.getNoticesByClassTeacher(classteacher).subscribe({
      next: (data: Notice[]) => {
        this.notices = data;
      },
      error: (error) => {
        console.error('Error fetching notices by classteacher:', error);
      }
    });
  }

  filterNoticesByRole(role: string): void {
    this.noticeService.getNoticesByRole(role).subscribe({
      next: (data: Notice[]) => {
        this.notices = data;
      },
      error: (error) => {
        console.error('Error fetching notices by role:', error);
      }
    });
  }
  loadTeachers() {
  this.userService.getUsers().subscribe({
    next: (users: any[]) => {

      // Normalize all data
      this.teachers = users
        .filter(u => {
          const role = (u.Role || u.role || "").toString().toLowerCase();
          return role === "teacher";
        })
        .map(u => u.username)
        .sort();
    },

    error: (err) => console.error("Failed to load teachers:", err)
  });
}


loadClasses() {
  this.studentService.getStudents().subscribe({
    
    next: (students: any[]) => {
      this.classList = [
  ...new Set(students.map(s => s.class).filter(Boolean))
].sort().concat(["All"]);


      console.log("Loaded class list:", this.classList);
    },
    error: (err) => console.error("Failed to load classes", err)
  });
}


}