import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { AdminService } from '../../services/admin.service';
import { NoticeService } from '../../services/notice.service';
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
  constructor(
    private userService: UserService,
    private adminService: AdminService,
    private noticeService: NoticeService,
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
}