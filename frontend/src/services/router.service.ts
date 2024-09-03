import * as router5 from "router5";
import browserPlugin from "router5-plugin-browser";
import { computed, makeObservable, observable } from "mobx";
import { Service } from "./service";
import { ExperimentEditor } from "./experiment.editor";

interface ServiceProvider {
  experimentEditor: ExperimentEditor;
}

/**
 * Handles app routing and page navigation
 */
export class RouterService extends Service {
  constructor(private readonly sp: ServiceProvider) {
    super();
    makeObservable(this);

    this.router = router5.createRouter(this.routes, {
      defaultRoute: Pages.HOME,
      // defaultParams,
      queryParams: { booleanFormat: "empty-true", nullFormat: "hidden" },
      queryParamsMode: "loose",
    });
  }

  protected readonly routes: router5.Route[] = [
    {
      name: Pages.HOME,
      path: "/",
    },
    {
      name: Pages.SETTINGS,
      path: "/settings",
    },
    {
      name: Pages.EXPERIMENT,
      path: "/:experiment",
    },
    {
      name: Pages.EXPERIMENT_CREATE,
      path: "/new_experiment",
    },
    {
      name: Pages.EXPERIMENT_EDIT,
      path: "/:experiment/edit",
    },
    {
      name: Pages.COHORT,
      path: "/:experiment/c/:cohort",
    },
    {
      name: Pages.PARTICIPANT,
      path: "/:experiment/p/:participant",
    }
  ];

  private readonly router: router5.Router;

  @observable.ref activeRoute: Route = { name: "", params: {}, path: "" };
  @observable isHandlingRouteChange = false;
  @observable hasNavigated = false; // True if navigated at least once in app

  @observable isExperimenterNavOpen = false;

  private getPage(route: Route): Pages | undefined {
    if (!route) return undefined;
    return route.name as Pages;
  }

  @computed
  get activePage(): Pages | undefined {
    return this.getPage(this.activeRoute);
  }

  @computed
  get isParticipantPage() {
    return this.activeRoute.params["participant"] !== undefined;
  }

  override initialize() {
    this.router.usePlugin(browserPlugin({ useHash: true }));
    this.router.subscribe((routeChange: RouteChange) => {
      this.handlerRouteChange(routeChange);
    });
    this.router.start();
  }

  private handlerRouteChange(routeChange: RouteChange) {
    this.activeRoute = routeChange.route;
  }

  setExperimenterNav(isOpen: boolean) {
    this.isExperimenterNavOpen = isOpen;
  }

  navigate(page: Pages, params: { [key: string]: string } = {}) {
    this.hasNavigated = true;

    // Update services for current route
    switch (page) {
      case Pages.EXPERIMENT_CREATE:
        // TODO: Only reset ID, not whole experiment
        this.sp.experimentEditor.resetExperiment();
        break;
      default:
        break;
    }

    return this.router.navigate(page, { ...params });
  }

  navigateToDefault() {
    this.router.navigateToDefault();
  }

  getActiveRoute() {
    if (this.activeRoute) return this.activeRoute;
    return this.router.getState();
  }

  getActiveRouteParams() {
    return this.activeRoute.params;
  }
}

/**
 * Type for onRouteChange callback subscription.
 */
export type Route = router5.State;

/**
 * Type for onRouteChange callback subscription.
 */
export type RouteChange = router5.SubscribeState;

/**
 * Enumeration of different pages.
 */
export enum Pages {
  COHORT = "COHORT",
  HOME = "HOME",
  EXPERIMENT = "EXPERIMENT",
  EXPERIMENT_CREATE = "EXPERIMENT_CREATE",
  EXPERIMENT_EDIT = "EXPERIMENT_EDIT",
  PARTICIPANT = "PARTICIPANT",
  SETTINGS = "SETTINGS",
}

/**
 * Metadata for top-level navigation pages.
 */
export interface NavItem {
  page: Pages;
  title: string;
  icon: string;
  isExperimenterPage: boolean;
  isParticipantPage: boolean;
  isPrimaryPage: boolean;
}

/**
 * Top-level navigation items.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    page: Pages.HOME,
    title: "Home",
    icon: "home",
    isExperimenterPage: true,
    isParticipantPage: false,
    isPrimaryPage: true,
  },
  {
    page: Pages.EXPERIMENT_CREATE,
    title: "New experiment",
    icon: "science",
    isExperimenterPage: true,
    isParticipantPage: false,
    isPrimaryPage: true,
  },
  {
    page: Pages.SETTINGS,
    title: "Settings",
    icon: "settings",
    isExperimenterPage: true,
    isParticipantPage: false,
    isPrimaryPage: false,
  },
];
