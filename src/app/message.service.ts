import { Injectable } from '@angular/core';

export interface AppMessage {
  text: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

@Injectable({ providedIn: 'root' })
export class MessageService {

  messages: AppMessage[] = [];

  add(text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    this.messages.push({ text, type });

    // Auto-clear after 10 seconds
    setTimeout(() => {
      this.messages.shift();
    }, 10000);
  }

  clear() {
    this.messages = [];
  }
}
