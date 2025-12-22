import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { HeroDetailComponent } from './hero-detail/hero-detail.component';
import { LoginComponent } from './components/login/login.component';
import { ExitComponent } from './components/exit/exit.component';
import { AdminComponent } from './components/admin/admin.component';
import { HeaderComponent } from './components/header/header.component';
import { SignUpComponent } from './components/sign-up/sign-up.component';
import { StuDashboardComponent } from './components/stu-dashboard/stu-dashboard.component';
import { TeacherComponent } from './components/teacher/teacher.component';
import { TeacherloginComponent } from './components/teacherlogin/teacherlogin.component';
import { TeacherTaskComponent } from './components/teachertask/teacher-task.component';
import { UserComponent } from './components/User/user.component';
import { StudentComponent } from './components/student/student.component';
import { StudentDetailsComponent } from './components/students/student-details/student-details.component';
import { NoticeComponent } from './components/notice/notice.component';
import { AttendanceComponent } from './components/attendance/attendance.component';
import { UploadPhotoComponent } from './components/upload-photo/upload-photo.component';
import { ExcelUploadComponent } from './components/Idcardprinting/components/excel-upload/excel-upload.component';
import { CardPreviewComponent } from './components/card-preview/card-preview.component';
import { MessagesComponent } from './messages/messages.component';
import { NoticupdatestudentComponent} from './NoticeUpdateStudent/noticupdatestudent.component';
import { UserProfileComponent } from './components/userdetail/user-profile.component';
import { StudentExlDataService } from './services/StudentExlDataService.service';
import { ComplainComponent } from './components/complain/complain/complain.component';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    HeroDetailComponent,
    LoginComponent,
    ExitComponent,
    AdminComponent,
    HeaderComponent,
    SignUpComponent,
    StuDashboardComponent,
    TeacherComponent,
    TeacherloginComponent,
    UserComponent,
    StudentComponent,
    StudentDetailsComponent,
    NoticeComponent,
    AttendanceComponent,
    UploadPhotoComponent,
    ExcelUploadComponent,
    CardPreviewComponent,
    MessagesComponent,
    UserProfileComponent,
    NoticupdatestudentComponent,
    ComplainComponent,
    TeacherTaskComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [StudentExlDataService],
  bootstrap: [AppComponent]
})
export class AppModule { }
