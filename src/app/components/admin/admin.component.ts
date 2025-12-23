import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { AdminService } from '../../services/admin.service';
import { NoticeService } from '../../services/notice.service';
import { TeacherService } from '../../services/teacher.service';
import { StudentProgress, StudentProgressService } from '../../services/student-progress.service';
@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  role: string = '';
  username: string = '';
  activeTab: string = 'dashboard'; // Default tab
  unapprovedUsers: any[] = [];
  pendingNotices: any[] = [];   // <-- store pending notices
  message: string = '';
adminProgressList: StudentProgress[] = [];
progressFilterClass: string = '';
progressFilterDate: string = '';
progressFilterSubject: string = '';
 sidebarOpen = false;
 selectedTeacherId: string = '';
  noticeText: string = '';
  allTeachers: any[] = [];
  constructor(
    private userService: UserService,
    private adminService: AdminService,
    private noticeService: NoticeService,
    private teacherService: TeacherService,
    private studentProgressService: StudentProgressService
  ) {}

  ngOnInit(): void {
    const userDetails = this.userService.getUserDetails();
    this.role = userDetails.role;
    this.username = userDetails.username;

    this.loadUnapprovedUsers();
    this.loadPendingNotices();   // <-- load pending notices instead of all
  }

  // Tab switching
  selectTab(tab: string): void {
    this.activeTab = tab;
  }
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }
  // Logout logic
  logout(): void {
    console.log('User logged out.');
    alert('You have been logged out!');
    // Add actual logout logic here (e.g., clear session, redirect)
  }

  // Admin action
  performAction(): void {
    console.log('Performing an admin action...');
    alert('Admin action triggered!');
  }

  // Load unapproved users
  loadUnapprovedUsers(): void {
    this.adminService.getPendingUsers().subscribe({
      next: (users) => (this.unapprovedUsers = users),
      error: (err) => console.error('Failed to load unapproved users', err),
    });
  }
deleteProgress(id: string) {
  if (!confirm("Are you sure you want to delete this record?")) return;

  this.studentProgressService.deleteProgress(id).subscribe({
    next: () => {
      alert("Deleted successfully.");
      this.loadAllProgress();
    },
    error: (err) => {
      console.error("Error deleting:", err);
      alert("Failed to delete.");
    }
  });
}

  // Approve a user
  approveUser(userId: string): void {
    this.adminService.approveUser(userId).subscribe({
      next: () => {
        this.message = 'User approved successfully';
        this.loadUnapprovedUsers(); // Refresh list
      },
      error: (err) => {
        console.error('Approval failed', err);
        this.message = 'Failed to approve user';
      },
    });
  }
loadAllProgress() {
  let params: any = {};
  if (this.progressFilterClass) params.className = this.progressFilterClass;
  if (this.progressFilterDate) params.date = this.progressFilterDate;
  if (this.progressFilterSubject) params.subject = this.progressFilterSubject;

  this.studentProgressService.getProgressByClass(params).subscribe({
    next: (res) => {
      this.adminProgressList = res || [];
    },
    error: (err) => {
      console.error("Error loading admin progress:", err);
    }
  });
}

  // Load pending notices
  loadPendingNotices(): void {
    this.noticeService.getUnapprovedNotices().subscribe({
      next: (data) => (this.pendingNotices = data),
      error: (err) => console.error('Failed to load pending notices', err),
    });
  }
updateTeacherNotice(): void {
    if (!this.selectedTeacherId || !this.noticeText.trim()) {
      alert('Please select a teacher and enter notice text');
      return;
    }

    const patch = { notice: this.noticeText };

    this.teacherService.editTeacher(this.selectedTeacherId, patch).subscribe({
      next: () => {
        this.message = 'Teacher notice updated successfully';
        this.noticeText = '';
        this.selectedTeacherId = '';
        alert('Notice updated!');
      },
      error: (err) => {
        console.error('Failed to update notice', err);
        this.message = 'Failed to update notice';
      }
    });
  }

  // Approve a notice
  approveNotice(noticeId: string): void {
    this.noticeService.approveNotice(noticeId).subscribe({
      next: () => {
        this.message = 'Notice approved successfully';
        this.loadPendingNotices(); // Refresh list
      },
      error: (err) => {
        console.error('Notice approval failed', err);
        this.message = 'Failed to approve notice';
      },
    });
  }
  updateAllTeachersNotice(): void {
  if (!this.noticeText.trim()) {
    alert('Please enter notice text');
    return;
  }

  if (this.allTeachers.length === 0) {
    alert('No teachers loaded. Please load teachers first.');
    return;
  }

  // Confirm before updating all
  if (!confirm(`Update notice for ${this.allTeachers.length} teachers?`)) {
    return;
  }

  const patch = { notice: this.noticeText };
  let updateCount = 0;
  let errorCount = 0;

  // Update each teacher
  this.allTeachers.forEach(teacher => {
    this.teacherService.editTeacher(teacher._id, patch).subscribe({
      next: () => {
        updateCount++;
        // Check if all updates completed
        if (updateCount + errorCount === this.allTeachers.length) {
          this.message = `Notice updated for ${updateCount} teachers${errorCount > 0 ? `, ${errorCount} failed` : ''}`;
          this.noticeText = '';
          alert(`Updated ${updateCount}/${this.allTeachers.length} teachers`);
        }
      },
      error: (err) => {
        errorCount++;
        console.error(`Failed to update teacher ${teacher._id}:`, err);
        
        if (updateCount + errorCount === this.allTeachers.length) {
          this.message = `Notice updated for ${updateCount} teachers, ${errorCount} failed`;
          alert(`Updated ${updateCount}/${this.allTeachers.length} teachers`);
        }
      }
    });
  });
}
loadAllTeachers(): void {
  this.teacherService.getTeachers().subscribe({
    next: (teachers) => {
      this.allTeachers = teachers;
      console.log('Loaded teachers:', this.allTeachers);
    },
    error: (err) => console.error('Failed to load teachers', err)
  });
}
}