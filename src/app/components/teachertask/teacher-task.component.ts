import { Component, OnInit } from '@angular/core';
import { TeacherTaskService, TeacherTask } from '../../services/teacher-task.service';
import { UserService } from '../../services/user.service';
import { TeacherService } from '../../services/teacher.service';
import { Teacher } from '../../components/models/Teacher';
@Component({
  selector: 'app-teacher-task',
  templateUrl: './teacher-task.component.html',
  styleUrls: ['./teacher-task.component.css']
})
export class TeacherTaskComponent implements OnInit {
selectedTeacher: any = null;
  tasks: TeacherTask[] = [];
  role = '';
  username = '';
teachers: Teacher[] = [];
  newTask: TeacherTask = {
    taskForUser: '',
    class: '',
    taskGivenBy: '',
    taskDescription: ''
  };

  constructor(
    private taskService: TeacherTaskService,
    private userService: UserService,
    private teacherService: TeacherService,
  ) {}

  ngOnInit(): void {
    const user = this.userService.getUserDetails();
    this.role = user.role;
    this.username = user.username;

    this.loadTasks();
    this.loadTeachers();
  }
onTeacherChange(t: any) {
  if (!t) {
    this.newTask.taskForUser = '';
    this.newTask.class = '';
    return;
  }

  this.newTask.taskForUser = t.name;   // or t.username, depending on backend
  this.newTask.class = t.class;        // auto-fill class from teacher
}
  loadTasks() {
    if (this.role === 'Admin') {
      this.taskService.getAllTasks().subscribe(res => this.tasks = res);
    } else {
      this.taskService.getTasksByUser(this.username).subscribe(res => this.tasks = res);
    }
  }
loadTeachers(): void {
    this.teacherService.getTeachers().subscribe({
      next: (teachers) => {
        this.teachers = teachers || [];
      },
      error: (err) => console.error('Error loading teachers', err),
    });
  }
  getTaskStatus(task: TeacherTask): string {
    if (task.completedOn) return 'Completed';

    const created = new Date(task.taskCreateDate!);
    const today = new Date();
    const diff = (today.getTime() - created.getTime()) / (1000 * 3600 * 24);

    return diff > 3 ? 'Delayed' : 'Pending';
  }

  addTask() {
    this.newTask.taskGivenBy = this.username;

    this.taskService.addTask(this.newTask).subscribe(() => {
      alert('Task Assigned & Notification Sent');
      this.newTask = { taskForUser: '', class: '', taskGivenBy: '', taskDescription: '' };
      this.loadTasks();
    });
  }

  markCompleted(taskId: string) {
    this.taskService.markCompleted(taskId).subscribe(() => {
      this.loadTasks();
    });
  }

  deleteTask(taskId: string) {
    if (confirm('Delete this task?')) {
      this.taskService.deleteTask(taskId).subscribe(() => this.loadTasks());
    }
  }
}
