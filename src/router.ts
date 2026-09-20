import { createRouter, createWebHistory } from 'vue-router'
import CommandsView from './views/CommandsView.vue'
import ConflictsView from './views/ConflictsView.vue'
import DashboardView from './views/DashboardView.vue'
import HelpView from './views/HelpView.vue'
import NewMemoryView from './views/NewMemoryView.vue'
import ObservationView from './views/ObservationView.vue'
import ProjectsView from './views/ProjectsView.vue'
import RecentView from './views/RecentView.vue'
import ReviewView from './views/ReviewView.vue'
import SearchView from './views/SearchView.vue'
import SessionsView from './views/SessionsView.vue'
import TimelineView from './views/TimelineView.vue'

// Only routes whose views exist are registered: the sidebar must never render a dead link.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/recent', name: 'recent', component: RecentView },
    { path: '/search', name: 'search', component: SearchView },
    { path: '/observations/:id', name: 'observation', component: ObservationView },
    { path: '/timeline/:id', name: 'timeline', component: TimelineView },
    { path: '/sessions', name: 'sessions', component: SessionsView },
    { path: '/review', name: 'review', component: ReviewView },
    { path: '/conflicts', name: 'conflicts', component: ConflictsView },
    { path: '/new', name: 'new-memory', component: NewMemoryView },
    { path: '/projects', name: 'projects', component: ProjectsView },
    { path: '/commands', name: 'commands', component: CommandsView },
    { path: '/help', name: 'help', component: HelpView },
  ],
})
