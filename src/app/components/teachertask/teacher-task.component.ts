import { Component } from '@angular/core';
import { TeacherService } from '../../services/teacher.service';
@Component({
  selector: 'app-teacher-task',
  
  templateUrl: './teacher-task.component.html',
  styleUrls: ['./teacher-task.component.css']
})
export class TeacherTaskComponent {
  tasks: any[] = [];

  constructor(private service: TeacherService) {
    this.service.getTasks().subscribe(r => this.tasks = r);
  }

  markDone(task: any) {
    task.status = 'Completed';
    this.service.updateTask(task).subscribe();
  }
}
