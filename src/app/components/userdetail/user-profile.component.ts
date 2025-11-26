import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService, User } from '../../services/user.service';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {

  profileForm!: FormGroup;
  user!: User;
  isAdmin = false;
  message = "";
  loading = true;

  roles = ['Admin', 'Teacher', 'Student', 'Principal'];

  constructor(private fb: FormBuilder, private userService: UserService) {}

  ngOnInit() {
    const logged = this.userService.getLoggedUser();

    if (!logged.username) {
      console.error("No logged-in user found");
      this.loading = false;
      return;
    }

    // Load user details from backend using username
    this.userService.getUserByUsername(logged.username).subscribe({
      next: (u: User) => {
        this.user = u;
        this.isAdmin = u.role === 'Admin';
        this.buildForm();
        this.loading = false;
      },
      error: () => {
        console.error("Failed to load user");
        this.loading = false;
      }
    });
  }

  buildForm() {
    this.profileForm = this.fb.group({
      username: [{ value: this.user.username, disabled: !this.isAdmin }, Validators.required],
      role: [{ value: this.user.role, disabled: !this.isAdmin }, Validators.required],
      password: [''], // Only send if changed
      isApproved: [{ value: this.user.isApproved, disabled: true }]
    });
  }


  saveChanges() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const data = this.profileForm.getRawValue();

    // If password is blank → do not send it
    if (!data.password || data.password.trim() === "") {
      delete data.password;
    }

    // Update user
    this.userService.updateUser(this.user._id!, data).subscribe({
      next: () => {
        this.message = "Profile updated successfully";
      },
      error: () => {
        this.message = "Update failed";
      }
    });
  }
}
