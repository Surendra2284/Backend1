import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css']
})
export class UserComponent implements OnInit {
  users: any[] = [];
  unapprovedUsers: any[] = [];
  selectedUser: any = null;

  newUser = { username: '', password: '', role: '', isApproved: false };
  message = '';

  // BULK IMPORT
  bulkPreview: any[] = [];
  bulkErrors: string[] = [];

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadUnapprovedUsers();
  }

  /* -------------------- LOAD USERS -------------------- */

  loadUsers(): void {
    this.userService.getUsers().subscribe({
      next: (data) => this.users = Array.isArray(data) ? data : [],
      error: (err) => console.error('Error loading users:', err)
    });
  }

  loadUnapprovedUsers(): void {
    this.userService.getPendingUsers().subscribe({
      next: (data) => this.unapprovedUsers = Array.isArray(data) ? data : [],
      error: (err) => console.error('Error loading pending users:', err)
    });
  }

  /* -------------------- CRUD -------------------- */

  selectUser(user: any): void {
    this.selectedUser = { ...user }; // full edit, password change allowed
  }

  addUser(): void {
    this.cleanUser(this.newUser);

    this.userService.addUser(this.newUser).subscribe({
      next: () => {
        this.message = 'User added successfully';
        this.loadUsers();
        this.newUser = { username: '', password: '', role: '', isApproved: false };
      },
      error: () => this.message = 'Failed to add user'
    });
  }

  updateUser(): void {
    if (!this.selectedUser?._id) return;

    this.cleanUser(this.selectedUser);

    this.userService.updateUser(this.selectedUser._id, this.selectedUser).subscribe({
      next: () => {
        this.message = 'User updated successfully';
        this.loadUsers();
        this.selectedUser = null;
      },
      error: () => this.message = 'Failed to update user'
    });
  }

  deleteUser(id: string): void {
    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.message = 'User deleted successfully';
        this.loadUsers();
      },
      error: () => this.message = 'Failed to delete user'
    });
  }

  approveUser(user: any): void {
    this.userService.approveUser(user._id).subscribe({
      next: () => {
        this.message = 'User approved successfully';
        this.loadUsers();
        this.loadUnapprovedUsers();
      },
      error: () => this.message = 'Approval failed'
    });
  }

  /* -------------------- CLEAN USERNAME -------------------- */

  cleanUser(user: any) {
    user.username = String(user.username).trim().replace(/\s+/g, '');
  }

  /* -------------------- BULK IMPORT -------------------- */

  async onExcelSelected(event: any) {
    this.bulkPreview = [];
    this.bulkErrors = [];

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.SheetNames[0];

      const json = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheet], { defval: "" });

      this.bulkPreview = json.map((row: any, i: number) => {
        const username = (row.Username || row.username || '').trim().replace(/\s+/g, '');
        const password = (row.Password || row.password || '').trim();
        const role = (row.Role || row.role || '').trim();

        const obj = { username, password, role, isApproved: false };

        const rowNum = i + 2;

        if (!username) this.bulkErrors.push(`Row ${rowNum}: Missing username`);
        if (!password) this.bulkErrors.push(`Row ${rowNum}: Missing password`);
        if (!role) this.bulkErrors.push(`Row ${rowNum}: Missing role`);

        return obj;
      });

    } catch (err) {
      this.bulkErrors.push("Invalid Excel file.");
    }
  }

  /* -------------------- BULK COMMIT -------------------- */

  async commitBulk() {
    if (!this.bulkPreview.length) return alert("No user data found!");

    if (this.bulkErrors.length) {
      return alert("Fix all errors before importing!");
    }

    let added = 0;
    let updated = 0;
    let failed = 0;

    const existingUsers = await this.userService.getUsers().toPromise();

    for (const user of this.bulkPreview) {
      this.cleanUser(user);

      const exists = existingUsers.find((u: any) => u.username === user.username);

      if (exists) {
        // UPDATE
        await this.userService.updateUser(exists._id, user).toPromise()
          .then(() => updated++)
          .catch(() => failed++);
      } else {
        // ADD
        await this.userService.addUser(user).toPromise()
          .then(() => added++)
          .catch(() => failed++);
      }
    }

    alert(
      `Bulk Import Complete:\n` +
      `Added: ${added}\nUpdated: ${updated}\nFailed: ${failed}`
    );

    this.loadUsers();
    this.bulkPreview = [];
  }

  /* ------------------ DOWNLOAD EXCEL TEMPLATE ------------------ */

  downloadTemplate() {
    const sample = [
      { Username: "sampleuser", Password: "123456", Role: "Student" }
    ];

    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    XLSX.writeFile(wb, 'users_template.xlsx');
  }
}
