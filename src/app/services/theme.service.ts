import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'fraudguard_theme';
  
  // Angular 17 Signal for reactive theme state
  theme = signal<ThemeMode>(this.getInitialTheme());

  constructor() {
    // Effect to apply theme whenever the signal changes
    effect(() => {
      const current = this.theme();
      this.applyTheme(current);
    });
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(newTheme: ThemeMode): void {
    this.theme.set(newTheme);
    try {
      localStorage.setItem(this.THEME_KEY, newTheme);
    } catch {
      // ignore
    }
  }

  isDark(): boolean {
    return this.theme() === 'dark';
  }

  private getInitialTheme(): ThemeMode {
    try {
      const saved = localStorage.getItem(this.THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'dark';
  }

  private applyTheme(theme: ThemeMode): void {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      document.body.classList.remove('bg-[#0A0A0A]', 'text-[#D4D4D4]');
      document.body.classList.add('bg-[#F7F6F2]', 'text-[#27272A]');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      document.body.classList.remove('bg-[#F7F6F2]', 'text-[#27272A]');
      document.body.classList.add('bg-[#0A0A0A]', 'text-[#D4D4D4]');
    }
  }
}
