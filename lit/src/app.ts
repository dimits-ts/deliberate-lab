import "./components/chat/chat_config";
import "./components/chat/chat_interface";
import "./components/experiment/experiment_config";
import "./components/header/header";
import "./components/home/home";
import "./components/info/info_config";
import "./components/login/login";
import "./components/settings/settings";
import "./components/sidenav/sidenav";

import { MobxLitElement } from "@adobe/lit-mobx";
import { CSSResultGroup, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import { core } from "./core/core";
import { AuthService } from "./services/auth_service";
import { ChatService } from "./services/chat_service";
import { ExperimentService } from "./services/experiment_service";
import { Pages, RouterService } from "./services/router_service";
import { SettingsService } from "./services/settings_service";

import {
  ColorMode,
  ColorTheme,
  Permission,
  StageConfig,
  StageKind,
  StageType,
  TextSize
} from "./shared/types";

import { styles } from "./app.scss";

/** App main component. */
@customElement("llm-mediation-app")
export class App extends MobxLitElement {
  static override styles: CSSResultGroup = [styles];

  private readonly authService = core.getService(AuthService);
  private readonly chatService = core.getService(ChatService);
  private readonly experimentService = core.getService(ExperimentService);
  private readonly routerService = core.getService(RouterService);
  private readonly settingsService = core.getService(SettingsService);

  override connectedCallback() {
    super.connectedCallback();
  }

  private renderPageContent() {
    switch(this.routerService.activePage) {
      case Pages.HOME:
        return html`<home-page></home-page>`;
      case Pages.SETTINGS:
        return html`<settings-page></settings-page>`;
      case Pages.EXPERIMENT:
        return this.renderExperiment();
      case Pages.EXPERIMENT_STAGE:
        return this.renderExperimentStage();
      default:
        return this.render404();
    }
  }

  private render404(message = "Page not found") {
    return html`<div>404: ${message}</div>`;
  }

  private renderExperiment() {
    const id = this.routerService.activeRoute.params["experiment"];
    if (id !== this.experimentService.id) {
      this.experimentService.setExperimentId(id);
    }

    if (this.experimentService.isLoading) {
      return html`<div>Loading experiment...</div>`;
    }

    if (this.authService.permission === Permission.EDIT) {
      return html`<experiment-config></experiment-config>`;
    }

    return html`<div>Experiment preview goes here</div>`;
  }

  private renderExperimentStage() {
    const id = this.routerService.activeRoute.params["experiment"];
    if (id !== this.experimentService.id) {
      this.experimentService.setExperimentId(id);
    }

    if (this.experimentService.isLoading) {
      return html`<div>Loading experiment...</div>`;
    }

    const index = Number(this.routerService.activeRoute.params["stage"]);
    if (index >= this.experimentService.stageNames.length) {
      return this.render404(`Could not find experiment stage ${index + 1}`);
    }
    const stageName = this.experimentService.stageNames[index];

    const currentStage: StageConfig =
      this.experimentService.stageConfigMap[stageName];

    if (currentStage.kind === StageKind.Info) {
      if (this.authService.permission === Permission.EDIT) {
        return html`<info-config></info-config>`;
      } else {
        return currentStage.kind === StageKind.Info ?
          html`<div>${currentStage.infoLines}</div>` : nothing;
      }
    }
    return this.render404("Could not load experiment stage");
  }

  override render() {
    const isMode = (mode: ColorMode) => {
      return this.settingsService.colorMode === mode;
    }

    const isTheme = (theme: ColorTheme) => {
      return this.settingsService.colorTheme === theme;
    };

    const isSize = (size: TextSize) => {
      return this.settingsService.textSize === size;
    };

    const classes = classMap({
      "app-wrapper": true,
      "mode--dark": isMode(ColorMode.DARK),
      "mode--light": isMode(ColorMode.LIGHT),
      "mode--default": isMode(ColorMode.DEFAULT),
      "size--small": isSize(TextSize.SMALL),
      "size--medium": isSize(TextSize.MEDIUM),
      "size--large": isSize(TextSize.LARGE),
    });

    if (!this.authService.authenticated) {
      // Render login screen if relevant after initial auth check
      return html`
        <div class=${classes}>
          <div class="content">
            ${this.authService.initialAuthCheck ?
              html`<login-page></login-page>` :
              nothing}
          </div>
        </div>
      `;
    }

    return html`
      <div class=${classes}>
        <main>
          <sidenav-menu></sidenav-menu>
          <div class="content-wrapper">
            <page-header></page-header>
            <div class="content">
              ${this.renderPageContent()}
            </div>
          </div>
        </main>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "llm-mediation-app": App;
  }
}