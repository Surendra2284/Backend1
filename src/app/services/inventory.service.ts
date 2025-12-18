import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
@Injectable({ providedIn: 'root' })
export class InventoryService {
  API = 'http://localhost:5000/inventory';
  constructor(private http: HttpClient) {}

  getInventory() {
    return this.http.get<any[]>(this.API);
  }
}
