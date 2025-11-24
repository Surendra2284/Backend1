import { Component } from '@angular/core';
import { StudentService } from '../services/student.service';
import { MessageService } from '../message.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-notic-updatestudent',
  templateUrl: './noticupdatestudent.component.html',
  styleUrls: ['./noticupdatestudent.component.css']
})
export class NoticupdatestudentComponent {

  loading = false;
  progress = 0;

  constructor(
    private studentService: StudentService,
    public messageService: MessageService
  ) {}

  resetComponent() {
    this.progress = 0;
    this.loading = false;
    this.messageService.clear();
  }

  // Download current Excel template
  downloadCurrentTemplate() {
    this.messageService.add("Generating Excel template...", "info");

    this.studentService.getAllStudentsFull().subscribe({
      next: (students: any[]) => {
        const data = students.map((s: any) => ({
          StudentID: s.studentId,
          Name: s.name,
          Notice: s.Notice || "",
          Attendance: s.attendance || 0,
          ReplaceMode: "Yes"
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

        XLSX.writeFile(workbook, "Current_Student_Notice_Attendance.xlsx");

        this.messageService.add("Template downloaded!", "success");
      },

      error: () => {
        this.messageService.add("Failed to load students ❌", "error");
      }
    });
  }

  // Excel Upload
  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    this.loading = true;
    this.progress = 10;

    this.messageService.clear();
    this.messageService.add("Uploading Excel file...", "info");

    const interval = setInterval(() => {
      if (this.progress < 90) this.progress += 10;
    }, 500);

    this.studentService.bulkUpdateNoticeAndAttendance(file).subscribe({
      next: (res: any) => {
        clearInterval(interval);
        this.progress = 100;
        this.loading = false;

        this.messageService.add(`Updated: ${res.updated}`, "success");
        this.messageService.add(`Not Found: ${res.notFound.length}`, "warning");
        this.messageService.add(`Name Mismatches: ${res.nameMismatch.length}`, "warning");
        this.messageService.add(`Errors: ${res.errors.length}`, "error");

        if (res.notFound.length > 0) {
          this.messageService.add(
            "Students not found: " + res.notFound.join(", "),
            "warning"
          );
        }

        res.nameMismatch.forEach((nm: any) =>
          this.messageService.add(
            `Name mismatch [${nm.studentId}]: Excel="${nm.excelName}" DB="${nm.dbName}"`,
            "error"
          )
        );

        res.errors.forEach((err: any) =>
          this.messageService.add(
            `Error: ${err.error} (Value: ${err.value})`,
            "error"
          )
        );

        this.messageService.add("Bulk update completed!", "success");
      },

      error: () => {
        clearInterval(interval);
        this.progress = 100;
        this.loading = false;
        this.messageService.add("Bulk update failed ❌", "error");
      }
    });
  }
}
