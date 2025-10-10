import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { NoticeService, Notice } from '../services/notice.service';

const PhotoUrl = `${environment.apiUrl}/photos`;

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  isLoading: boolean = true;
  photos: { name: string; image: string }[] = [];
  notices: Notice[] = [];
  errorMessage: string = '';

  constructor(
    private http: HttpClient,
    private noticeService: NoticeService
  ) {}

currentSlide = 0;
modalOpen = false;
modalImage = '';
slideInterval: any;



ngOnDestroy(): void {
  // Clear interval when component is destroyed
  if (this.slideInterval) {
    clearInterval(this.slideInterval);
  }
}

startAutoSlide() {
  this.slideInterval = setInterval(() => {
    this.nextSlide();
  }, 5000); // 5000ms = 5 seconds
}

nextSlide() {
  this.currentSlide = (this.currentSlide + 1) % this.photos.length;
}

prevSlide() {
  this.currentSlide = (this.currentSlide - 1 + this.photos.length) % this.photos.length;
}

openModal(image: string) {
  this.modalImage = image;
  this.modalOpen = true;
  clearInterval(this.slideInterval); // pause auto-slide when modal is open
}

closeModal() {
  this.modalOpen = false;
  this.startAutoSlide(); // resume auto-slide when modal closes
}
  ngOnInit(): void {
    this.fetchPhotos();
    this.loadNotices();
    this.startAutoSlide();
  }

  fetchPhotos(): void {
    this.http.get<any[]>(PhotoUrl).subscribe(
      (data) => {
        this.photos = data;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error fetching photos:', error);
        this.isLoading = false;
      }
    );
  }
loadNotices(): void {
  this.noticeService.getApprovedNotices().subscribe((data: Notice[]) => {
    // Sort notices by Noticeid in descending order (latest first)
    const sorted = data.sort((a, b) => parseInt(b.Noticeid) - parseInt(a.Noticeid));
    this.notices = sorted; 
  });
}
  fetchNotices(): void {
    this.noticeService.getNotices().subscribe(
      (data) => {
        this.notices = data;
      },
      (error) => {
        console.error('Error fetching notices:', error);
        this.errorMessage = 'Error fetching notices.';
      }
    );
  }
}
