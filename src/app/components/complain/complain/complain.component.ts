import { Component, OnInit } from '@angular/core';
import { ComplainService } from '../../../services/complain.service';

@Component({
  selector: 'app-complain',
  templateUrl: './complain.component.html',
  styleUrls: ['./complain.component.scss']
})
export class ComplainComponent implements OnInit {

  complains: any[] = [];
  complaintText = '';
  remark = '';
  resolvedFilter: boolean | null = null;
userId='Admin';
class='All';
  user = {
  username: localStorage.getItem('username') ?? '',
  userId: localStorage.getItem('userId') ?? '',
  class: localStorage.getItem('class') ?? '',
  role: localStorage.getItem('userRole') ?? ''
};


  constructor(private service: ComplainService) {}

  ngOnInit() {
    this.loadAll();
    this.user.userId = this.userId;
    this.user.class = this.class;
  }

  loadAll() {
    this.service.getAll().subscribe(res => this.complains = res);
  }

  addComplaint() {
    const payload = {
      
      ...this.user,
      Notice: this.complaintText,
      dated: new Date()
    };
console.log(this.user);
    this.service.add(payload).subscribe(() => {
      this.complaintText = '';
      this.loadAll();
    });
  }

  resolve(c: any) {
    this.service.update(c._id, {
      resolved: true,
      resolveDate: new Date(),
      remark: this.remark
    }).subscribe(() => this.loadAll());
  }

  filterByUser() {
    this.service.getByUsername(this.user.username!).subscribe(r => this.complains = r);
  }

  filterByClass() {
    this.service.getByClass(this.user.class!).subscribe(r => this.complains = r);
  }

  filterResolved(status: boolean) {
    this.service.getResolved(status).subscribe(r => this.complains = r);
  }
  deleteComplain(id: string) {
    if (!confirm('Delete this complaint?')) return;

    this.service.delete(id).subscribe(() => {
      this.loadAll();
    });
  }

  // ✅ delete all resolved complaints
  deleteAllResolved() {
    const resolved = this.complains.filter(c => c.resolved);
    if (!resolved.length) {
      alert('No resolved complaints to delete.');
      return;
    }

    if (!confirm(`Delete all ${resolved.length} resolved complaints?`)) {
      return;
    }

    let deleted = 0;

    resolved.forEach(c => {
      this.service.delete(c._id).subscribe({
        next: () => { deleted++; },
        error: err => console.error('Delete error', err)
      });
    });

    setTimeout(() => {
      alert(`Deleted ${deleted} resolved complaints.`);
      this.loadAll();
    }, 800);
  }
}
