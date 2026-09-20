import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from './views/DashboardView.vue'
import ObservationView from './views/ObservationView.vue'
import RecentView from './views/RecentView.vue'

// Only routes whose views exist are registered: the sidebar must never render a dead link.
// Timeline, sessions, review and conflicts arrive with their own views.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/recent', name: 'recent', component: RecentView },
    { path: '/observations/:id', name: 'observation', component: ObservationView },
  ],
})
