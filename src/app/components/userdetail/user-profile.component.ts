import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {

  profileForm!: FormGroup;
  user: any = null;
  isAdmin = false;
  message = "";

  roles = ['Admin', 'Teacher', 'Student', 'Principal'];

  constructor(private fb: FormBuilder, private userService: UserService) {}

  ngOnInit() {
    const stored = this.userService.getUserDetails();  // { userId, username }
    this.user = stored;
    this.isAdmin = stored.userId === 'Admin';

    this.loadUserFromDB();
  }

  loadUserFromDB() {
    this.userService.getUserById(this.user.userId).subscribe({
      next: (u) => {
        this.user = u;
        this.buildForm();
      },
      error: (err) => console.error("Failed to load user details", err)
    });
  }

  buildForm() {
    this.profileForm = this.fb.group({
      username: [{ value: this.user.username, disabled: !this.isAdmin }, Validators.required],
      role: [{ value: this.user.role, disabled: !this.isAdmin }, Validators.required],
      password: [''], // optional
      isApproved: [{ value: this.user.isApproved, disabled: !this.isAdmin }]
    });
  }

  saveChanges() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const data = this.profileForm.getRawValue();

    if (!data.password?.trim()) {
      delete data.password;  // do not overwrite password
    }

    this.userService.updateUser(this.user._id, data).subscribe({
      next: () => {
        this.message = "Updated successfully";
        this.loadUserFromDB();
      },
      error: () => this.message = "Update failed"
    });
  }

}
