import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '../../shared/auth-service'
import { Subscription } from 'rxjs';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // ✅ Make sure this import is present


@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit,OnDestroy {
  private authenticatedSub: Subscription = new Subscription();

    userAuthenticated = false;
  constructor(private authService: AuthService, private router: Router) { 

  }

  ngOnDestroy(): void {
    this.authenticatedSub.unsubscribe();  
  }
  goToDashboard(): void {
  const route = this.authService.getDashboardRoute();
  this.router.navigate([route]);
}
  ngOnInit(): void {
    this.userAuthenticated = this.authService.getIsAuthenticated();
    this.authenticatedSub = this.authService.getAuthenticatedSub().subscribe(status => {
      this.userAuthenticated = status;
      
    }
    )
  }
  logout(){
    this.authService.logout();
    
  }


}

  

