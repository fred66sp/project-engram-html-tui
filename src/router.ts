import { createRouter, createWebHistory } from 'vue-router'
import ConflictsView from './views/ConflictsView.vue'
import DashboardView from './views/DashboardView.vue'
import ObservationView from './views/ObservationView.vue'
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
  ],
})
