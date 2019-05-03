import {Injectable, PipeTransform} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';

import {HttpClient} from '@angular/common/http';
import {User} from '../models/User';
import {DecimalPipe} from '@angular/common';
import {CoreResponse} from '../models/CoreResponse';
import { environment } from '../../environments/environment';
import {SortDirection} from './sortable-header.directive';
import {Perm} from '../models/Perm';
import {tap} from 'rxjs/internal/operators/tap';
import {debounceTime, delay, map} from 'rxjs/operators';
import {switchMap} from 'rxjs/internal/operators/switchMap';

const API_URL = environment.apiUrl;

interface SearchResult {
  perms: Perm[];
  total: number;
}

interface State {
  page: number;
  pageSize: number;
  searchTerm: string;
  sortColumn: string;
  sortDirection: SortDirection;
}

function compare(v1, v2) {
  return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
}

function sort(perms: Perm[], column: string, direction: string): Perm[] {
  if (direction === '') {
    return perms;
  } else {
    return [...perms].sort((a, b) => {
      const res = compare(a[column], b[column]);
      return direction === 'asc' ? res : -res;
    });
  }
}

function matches(perm: Perm, term: string, pipe: PipeTransform) {
  return pipe.transform(perm.id).includes(term)
    || perm.name.toLowerCase().includes(term)
    || perm.description.toLowerCase().includes(term);
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private currentUserSubject: BehaviorSubject<User>;
  public currentUser: Observable<User>;

  private _loading$ = new BehaviorSubject<boolean>(true);
  private _search$ = new Subject<void>();
  private _perms$ = new BehaviorSubject<Perm[]>([]);
  private _total$ = new BehaviorSubject<number>(0);

  private _state: State = {
    page: 1,
    pageSize: 5,
    searchTerm: '',
    sortColumn: '',
    sortDirection: ''
  };

  constructor(private http: HttpClient, private pipe: DecimalPipe) {
    this.currentUserSubject = new BehaviorSubject<User>(JSON.parse(localStorage.getItem('current_user')));
    this.currentUser = this.currentUserSubject.asObservable();

    this.getUser();

    this._search$.pipe(
      tap(() => this._loading$.next(true)),
      debounceTime(200),
      switchMap(() => this._search()),
      delay(200),
      tap(() => this._loading$.next(false))
    ).subscribe(result => {
      this._perms$.next(result.perms);
      this._total$.next(result.total);
    });

    this._search$.next();
  }

  public get currentUserValue(): User {
    return this.currentUserSubject.value;
  }

  public getUser() {
    this.http.get<CoreResponse>(API_URL + '/sso/user')
      .subscribe((res) => {
        if (!res || res.request.result === 'failed') {
          this.logoutData(null);
          return;
        }

        if (res.request.result === 'success' && res.body.user) {
          localStorage.setItem('current_user', JSON.stringify(res.body.user));
          this.currentUserSubject.next(res.body.user);
        }
      });
  }

  public login() {
    const callback = 'https://profile.vatpac.org/';
    window.location.href = API_URL + '/sso?callback=' + encodeURIComponent(callback);
  }

  public logout() {
    this.logoutData((res) => {
      console.log('Logged out successfully');
      window.location.reload();
    });
  }

  public logoutData(cb) {
    localStorage.removeItem('current_user');
    this.currentUserSubject.next(null);

    return this.http.get(`${API_URL}/sso/logout`).subscribe(cb);
  }

  public loggedIn() {
    return this.currentUserValue !== null;
  }

  public loggedInObserve() {
    return this.currentUser.pipe(map(user => user !== null));
  }


  get perms$() { return this._perms$.asObservable(); }
  get total$() { return this._total$.asObservable(); }
  get loading$() { return this._loading$.asObservable(); }

  get page() { return this._state.page; }
  set page(page: number) { this._set({page}); }

  get pageSize() { return this._state.pageSize; }
  set pageSize(pageSize: number) { this._set({pageSize}); }

  get searchTerm() { return this._state.searchTerm; }
  set searchTerm(searchTerm: string) { this._set({searchTerm}); }

  set sortColumn(sortColumn: string) { this._set({sortColumn}); }
  set sortDirection(sortDirection: SortDirection) { this._set({sortDirection}); }

  private _set(patch: Partial<State>) {
    Object.assign(this._state, patch);
    this._search$.next();
  }

  private _search(): Observable<SearchResult> {
    const {sortColumn, sortDirection, pageSize, page, searchTerm} = this._state;

    return this.currentUser.pipe(map(user => {
      if (user) {
        const ps = user.perms;

        if (Array.isArray(ps)) {
          // 1. sort
          let perms = sort(ps, sortColumn, sortDirection);

          // 2. filter
          perms = perms.filter(perm => matches(perm, searchTerm, this.pipe));
          const total = perms.length;

          // 3. paginate
          perms = perms.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

          return {perms, total};
        }
      }

      return {perms: [], total: 0};
    }));
  }
}
