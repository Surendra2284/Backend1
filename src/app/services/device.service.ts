import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {

  isMobileApp: boolean = false;
  isMobileScreen: boolean = false;

  constructor() {
    this.detectPlatform();
  }

  private detectPlatform() {
    this.isMobileApp = Capacitor.isNativePlatform();
    this.isMobileScreen = window.innerWidth < 768;

    window.addEventListener('resize', () => {
      this.isMobileScreen = window.innerWidth < 768;
    });
  }
}
