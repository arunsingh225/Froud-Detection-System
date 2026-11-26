import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ChangePasswordModalComponent, passwordProblem } from './change-password-modal.component';
import { AuthService } from '../../services/auth.service';

describe('passwordProblem (mirrors the server policy)', () => {
  it('accepts a password with a letter and a number, 8 or more characters', () => {
    expect(passwordProblem('Abcdef12', 'old')).toBeNull();
  });

  it('explains what is wrong, without repeating the password', () => {
    expect(passwordProblem('Ab1', '')).toContain('at least 8');
    expect(passwordProblem('abcdefgh', '')).toContain('letter and one number');
    expect(passwordProblem('12345678', '')).toContain('letter and one number');
    expect(passwordProblem(' Abcdef12', '')).toContain('space');
    expect(passwordProblem('Abcdef12', 'Abcdef12')).toContain('different');
  });
});

describe('ChangePasswordModalComponent', () => {
  let fixture: ComponentFixture<ChangePasswordModalComponent>;
  let change: jasmine.Spy;
  let router: Router;

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (id: string) => el().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const fill = (current: string, next: string, confirm: string) => {
    const c = fixture.componentInstance;
    c.current = current; c.next = next; c.confirm = confirm;
    fixture.detectChanges();
  };

  beforeEach(() => {
    change = jasmine.createSpy('changePassword').and.resolveTo('Password changed. Please sign in again with the new password.');
    TestBed.configureTestingModule({
      imports: [ChangePasswordModalComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: { changePassword: change } }]
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ChangePasswordModalComponent);
    fixture.detectChanges();
  });

  it('keeps the save button disabled until everything is valid', () => {
    expect((q('change-password-save') as HTMLButtonElement).disabled).toBeTrue();
    fill('OldPassw0rd', 'short', 'short');
    expect((q('change-password-save') as HTMLButtonElement).disabled).toBeTrue();
    expect(q('change-password-hint')!.textContent).toContain('at least 8');
    fill('OldPassw0rd', 'NewPassw0rd', 'Different1');
    expect(q('change-password-mismatch')).not.toBeNull();
    expect((q('change-password-save') as HTMLButtonElement).disabled).toBeTrue();
    fill('OldPassw0rd', 'NewPassw0rd', 'NewPassw0rd');
    expect((q('change-password-save') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('sends both passwords, shows the result and then goes to the sign-in page', fakeAsync(() => {
    fill('OldPassw0rd', 'NewPassw0rd', 'NewPassw0rd');
    fixture.componentInstance.submit();
    tick();
    fixture.detectChanges();

    expect(change).toHaveBeenCalledOnceWith('OldPassw0rd', 'NewPassw0rd');
    expect(q('change-password-done')!.textContent).toContain('Password changed');
    expect(fixture.componentInstance.next).toBe('');                  // nothing is kept in memory
    expect(router.navigate).not.toHaveBeenCalled();
    tick(1500);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  }));

  it('shows the server reason, keeps what was typed and lets the user try again', async () => {
    change.and.rejectWith(new Error('The current password is not correct.'));
    fill('WrongPassw0rd', 'NewPassw0rd', 'NewPassw0rd');
    await fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(q('change-password-error')!.textContent).toContain('not correct');
    expect(fixture.componentInstance.current).toBe('WrongPassw0rd');
    expect((q('change-password-save') as HTMLButtonElement).disabled).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not close while saving, and cancel emits closed otherwise', () => {
    const closed = jasmine.createSpy('closed');
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.saving = true;
    fixture.componentInstance.close();
    expect(closed).not.toHaveBeenCalled();
    fixture.componentInstance.saving = false;
    fixture.componentInstance.close();
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
