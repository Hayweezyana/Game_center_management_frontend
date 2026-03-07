type PrefetchRoute = '/checkout' | '/gameselection' | '/report';

const prefetchedRoutes = new Set<PrefetchRoute>();

const routeLoaders: Record<PrefetchRoute, () => Promise<unknown>> = {
  '/checkout': () => import('../components/checkout'),
  '/gameselection': () => import('../components/GameSelection'),
  '/report': () => import('../components/report'),
};

export const prefetchRoute = (route: PrefetchRoute) => {
  if (prefetchedRoutes.has(route)) {
    return;
  }

  prefetchedRoutes.add(route);
  void routeLoaders[route]().catch(() => {
    prefetchedRoutes.delete(route);
  });
};

export const getRoutePrefetchProps = (route: PrefetchRoute) => ({
  onMouseEnter: () => prefetchRoute(route),
  onFocus: () => prefetchRoute(route),
  onTouchStart: () => prefetchRoute(route),
});
