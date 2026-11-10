import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AUTHOR, COAUTHOR, DISCLAIMER, PORTFOLIO_URL, PROJECT_URL, REPO_URL } from './data/site';
import { Brand, Icon } from './shared/icon';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Brand, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  protected readonly links = { author: AUTHOR, coauthor: COAUTHOR, portfolio: PORTFOLIO_URL, project: PROJECT_URL, repo: REPO_URL };
  protected readonly disclaimer = DISCLAIMER;
  protected readonly year = new Date().getFullYear();
}
