import {Component, OnInit, QueryList, ViewChildren} from '@angular/core';
import {UserService} from '../services/user.service';
import {SortableHeaderDirective, SortEvent} from '../services/sortable-header.directive';
import {Router} from '@angular/router';
import {Observable} from 'rxjs';
import {Perm} from '../models/Perm';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  isArray = Array.isArray;

  perms$: Observable<Perm[]>;
  total$: Observable<number>;

  @ViewChildren(SortableHeaderDirective) headers: QueryList<SortableHeaderDirective>;

  constructor(public usersService: UserService, public router: Router) {
    this.perms$ = usersService.perms$;
    this.total$ = usersService.total$;
  }

  ngOnInit() {
  }

  onSort({column, direction}: SortEvent) {
    // resetting other headers
    this.headers.forEach(header => {
      if (header.sortable !== column) {
        header.direction = '';
      }
    });

    this.usersService.sortColumn = column;
    this.usersService.sortDirection = direction;
  }

}
