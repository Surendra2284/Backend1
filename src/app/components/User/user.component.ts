import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';

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

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadUnapprovedUsers();
  }

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

  selectUser(user: any): void {
    this.selectedUser = { ...user };
  }

  addUser(): void {
    this.userService.addUser(this.newUser).subscribe({
      next: () => {
        this.message = 'User added successfully';
        this.loadUsers();
        this.newUser = { username: '', password: '', role: '', isApproved: false };
      },
      error: (err) => {
        console.error('Add user error:', err);
        this.message = 'Failed to add user';
      }
    });
  }

  updateUser(): void {
    if (!this.selectedUser?._id) return;
    this.userService.updateUser(this.selectedUser._id, this.selectedUser).subscribe({
      next: () => {
        this.message = 'User updated successfully';
        this.loadUsers();
        this.selectedUser = null;
      },
      error: (err) => {
        console.error('Update user error:', err);
        this.message = 'Failed to update user';
      }
    });
  }

  deleteUser(id: string): void {
    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.message = 'User deleted successfully';
        this.loadUsers();
      },
      error: (err) => {
        console.error('Delete user error:', err);
        this.message = 'Failed to delete user';
      }
    });
  }

  approveUser(user: any): void {
    this.userService.approveUser(user._id).subscribe({
      next: () => {
        this.message = 'User approved';
        this.loadUnapprovedUsers();
        this.loadUsers();
      },
      error: (err) => {
        console.error('Approve user error:', err);
        this.message = 'Approval failed';
      }
    });
  }
}