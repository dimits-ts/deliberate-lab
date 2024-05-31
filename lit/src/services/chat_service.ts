import { computed, observable, makeObservable } from "mobx";
import { Service } from "./service";
import { AuthService } from "./auth_service";
import { SettingsService } from "./settings_service";

import { ChatMessage } from "../shared/types";
import { generateId } from "../shared/utils";

interface ServiceProvider {
  authService: AuthService;
  settingsService: SettingsService;
}

export class ChatService extends Service {
  constructor(private readonly sp: ServiceProvider) {
    super();
    makeObservable(this);
  }

  @observable chats: ChatMessage[] = [];

  setChats(chats: ChatMessage[]) {
    this.chats = chats;
  }

  addChatMessage(content: string) {
    this.chats.push({
      id: generateId(),
      author: this.sp.authService.userId,
      content
    });
  }
}