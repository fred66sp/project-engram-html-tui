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

/**
 * Fields the shell bar can offer. A route declares only the ones its view actually reads, so no
 * screen shows a control that would do nothing. Measured in the views: Panel, Sesiones, Review and
 * Conflictos read `filters.project` only; Recientes y Búsqueda also read `scope` and `type`.
 */
export type FilterField = 'project' | 'scope' | 'type'

/**
 * What the shell bar shows on a route: the shared fields the view reads, or the catalog's own
 * group/search pair (`'commands'`). An omitted `filters` means the screen has no bar, which is the
 * same thing an empty list would say.
 */
export type FilterBarSpec = readonly FilterField[] | 'commands'

declare module 'vue-router' {
  interface RouteMeta {
    filters?: FilterBarSpec
  }
}

/** Named once so the route table stays a table. */
const PROJECT_ONLY: FilterBarSpec = ['project']
const PROJECT_SCOPE_TYPE: FilterBarSpec = ['project', 'scope', 'type']

// Only routes whose views exist are registered: the sidebar must never render a dead link.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView, meta: { filters: PROJECT_ONLY } },
    { path: '/recent', name: 'recent', component: RecentView, meta: { filters: PROJECT_SCOPE_TYPE } },
    { path: '/search', name: 'search', component: SearchView, meta: { filters: PROJECT_SCOPE_TYPE } },
    { path: '/observations/:id', name: 'observation', component: ObservationView },
    { path: '/timeline/:id', name: 'timeline', component: TimelineView },
    { path: '/sessions', name: 'sessions', component: SessionsView, meta: { filters: PROJECT_ONLY } },
    { path: '/review', name: 'review', component: ReviewView, meta: { filters: PROJECT_ONLY } },
    { path: '/conflicts', name: 'conflicts', component: ConflictsView, meta: { filters: PROJECT_ONLY } },
    { path: '/new', name: 'new-memory', component: NewMemoryView },
    { path: '/projects', name: 'projects', component: ProjectsView },
    { path: '/commands', name: 'commands', component: CommandsView, meta: { filters: 'commands' } },
    { path: '/help', name: 'help', component: HelpView },
  ],
})
