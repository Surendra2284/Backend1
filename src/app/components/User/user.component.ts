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
  filteredUsers: any[] = [];
  selectedUser: any = null;

  // Forms
  newUser = { username: '', password: '', role: '', isApproved: false };
  message = '';

  // Bulk import
  bulkPreview: any[] = [];
  bulkErrors: string[] = [];

  // Pagination
  page = 1;
  pageSize = 10;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadUnapprovedUsers();
  }

  /* ------------------------- LOAD USERS ------------------------- */

  loadUsers(): void {
    this.userService.getUsers().subscribe({
      next: (data) => {
        this.users = Array.isArray(data) ? data : [];
        this.filteredUsers = [...this.users];
      },
      error: (err) => console.error('Load users error:', err)
    });
  }

  loadUnapprovedUsers(): void {
    this.userService.getPendingUsers().subscribe({
      next: (data) => this.unapprovedUsers = data,
      error: (err) => console.error('Load pending users error:', err)
    });
  }

  /* ------------------------- CRUD FUNCTIONS ------------------------- */

  selectUser(user: any): void {
    this.selectedUser = { ...user };
  }

  addUser(): void {
    this.newUser.username = this.newUser.username.trim();

    this.userService.addUser(this.newUser).subscribe({
      next: () => {
        this.message = 'User added successfully';
        this.loadUsers();
        this.newUser = { username: '', password: '', role: '', isApproved: false };
      }
    });
  }

  updateUser(): void {
    if (!this.selectedUser?._id) return;

    this.selectedUser.username = this.selectedUser.username.trim();

    this.userService.updateUser(this.selectedUser._id, this.selectedUser).subscribe({
      next: () => {
        this.message = 'User updated successfully';
        this.loadUsers();
        this.selectedUser = null;
      }
    });
  }
updateUser1() {
  if (!this.selectedUser?._id) {
    alert("No user selected!");
    return;
  }

  const updatedData = {
    username: this.newUser.username,
    password: this.newUser.password,
    role: this.newUser.role
  };

  this.userService.updateUser(this.selectedUser._id, updatedData).subscribe({
    next: () => {
      alert("User Updated Successfully");
      this.loadUsers();
      this.newUser = { username: "", password: "", role: "",isApproved: this.selectedUser.isApproved ?? true };
    },
    error: (err) => {
      console.error(err);
      alert("Failed to update user");
    }
  });
}

  deleteUser(id: string): void {
    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.message = 'User deleted successfully';
        this.loadUsers();
      }
    });
  }

  approveUser(user: any): void {
    this.userService.approveUser(user._id).subscribe({
      next: () => {
        this.message = 'User approved successfully';
        this.loadUsers();
        this.loadUnapprovedUsers();
      }
    });
  }

  approveAll(): void {
    let count = 0;

    this.unapprovedUsers.forEach(u => {
      this.userService.approveUser(u._id).subscribe({
        next: () => count++
      });
    });

    setTimeout(() => {
      alert(`Approved ${count} users`);
      this.loadUsers();
      this.loadUnapprovedUsers();
    }, 1000);
  }

  /* ------------------------- SEARCH + SORT ------------------------- */

  searchText = '';

  searchUsers() {
    const q = this.searchText.toLowerCase().trim();

    this.filteredUsers = this.users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );

    this.page = 1;
  }

  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  sort(col: string) {
    if (this.sortColumn === col) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = col;
      this.sortDirection = 'asc';
    }

    this.filteredUsers.sort((a, b) => {
      const A = (a[col] || '').toString().toLowerCase();
      const B = (b[col] || '').toString().toLowerCase();
      return this.sortDirection === 'asc' ? A.localeCompare(B) : B.localeCompare(A);
    });
  }

  /* ------------------------- PAGINATION ------------------------- */

  get totalPages() {
    return Math.ceil(this.filteredUsers.length / this.pageSize);
  }

  get paginatedUsers() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  prevPage() {
    if (this.page > 1) this.page--;
  }

  nextPage() {
    if (this.page < this.totalPages) this.page++;
  }

  goToPage(n: number) {
    this.page = n;
  }

  /* ------------------------- EXPORT ------------------------- */

  exportUsers() {
    const ws = XLSX.utils.json_to_sheet(this.users);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "users_export.xlsx");
  }

  downloadTemplate() {
    const sample = [
      { Username: "john", Password: "12345", Role: "Teacher" }
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "user_template.xlsx");
  }

  /* ------------------------- BULK IMPORT ------------------------- */

  async onExcelSelected(event: any) {
    this.bulkPreview = [];
    this.bulkErrors = [];

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const json = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]], { defval: "" });

      this.bulkPreview = json.map((row: any, i: number) => {
       const username = (row.Username || row.username || "").trim();

        const password = row.Password || row.password || "";
        const role = row.Role || row.role || "";

        if (!username) this.bulkErrors.push(`Row ${i + 2}: Missing username`);
        if (!password) this.bulkErrors.push(`Row ${i + 2}: Missing password`);
        if (!role) this.bulkErrors.push(`Row ${i + 2}: Missing role`);

        return { username, password, role, isApproved: false };
      });

    } catch {
      this.bulkErrors.push("Invalid Excel file");
    }
  }

  commitBulk() {
    let inserted = 0;
    let updated = 0;

    this.bulkPreview.forEach(user => {
      const existing = this.users.find(u => u.username === user.username);

      if (existing) {
        this.userService.updateUser(existing._id, user).subscribe(() => updated++);
      } else {
        this.userService.addUser(user).subscribe(() => inserted++);
      }
    });

    setTimeout(() => {
      alert(`Bulk Operation Completed:\nInserted: ${inserted}\nUpdated: ${updated}`);
      this.loadUsers();
    }, 1500);
  }
}
