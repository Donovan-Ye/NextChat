import Fuse from "fuse.js";
import { nanoid } from "nanoid";
import { StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";

export interface Prompt {
  id: string;
  isUser?: boolean;
  title: string;
  content: string;
  createdAt: number;
}

export const SearchService = {
  ready: false,
  builtinEngine: new Fuse<Prompt>([], { keys: ["title"] }),
  userEngine: new Fuse<Prompt>([], { keys: ["title"] }),
  count: {
    builtin: 0,
  },
  allPrompts: [] as Prompt[],
  builtinPrompts: [] as Prompt[],

  init(builtinPrompts: Prompt[], userPrompts: Prompt[]) {
    if (this.ready) {
      return;
    }
    this.allPrompts = userPrompts.concat(builtinPrompts);
    this.builtinPrompts = builtinPrompts.slice();
    this.builtinEngine.setCollection(builtinPrompts);
    this.userEngine.setCollection(userPrompts);
    this.ready = true;
  },

  remove(id: string) {
    this.userEngine.remove((doc) => doc.id === id);
  },

  add(prompt: Prompt) {
    this.userEngine.add(prompt);
  },

  search(text: string) {
    const userResults = this.userEngine.search(text);
    const builtinResults = this.builtinEngine.search(text);
    return userResults.concat(builtinResults).map((v) => v.item);
  },
};

export const usePromptStore = createPersistStore(
  {
    counter: 0,
    prompts: {} as Record<string, Prompt>,
  },

  (set, get) => ({
    add(prompt: Prompt) {
      const prompts = get().prompts;
      prompt.id = nanoid();
      prompt.isUser = true;
      prompt.createdAt = Date.now();
      prompts[prompt.id] = prompt;

      set(() => ({
        prompts: prompts,
      }));

      return prompt.id!;
    },

    get(id: string) {
      const targetPrompt = get().prompts[id];

      if (!targetPrompt) {
        return SearchService.builtinPrompts.find((v) => v.id === id);
      }

      return targetPrompt;
    },

    remove(id: string) {
      const prompts = get().prompts;
      delete prompts[id];

      Object.entries(prompts).some(([key, prompt]) => {
        if (prompt.id === id) {
          delete prompts[key];
          return true;
        }
        return false;
      });

      SearchService.remove(id);

      set(() => ({
        prompts,
        counter: get().counter + 1,
      }));
    },

    getUserPrompts() {
      const userPrompts = Object.values(get().prompts ?? {});
      userPrompts.sort((a, b) =>
        b.id && a.id ? b.createdAt - a.createdAt : 0,
      );
      return userPrompts;
    },

    updatePrompt(id: string, updater: (prompt: Prompt) => void) {
      const prompt = get().prompts[id] ?? {
        title: "",
        content: "",
        id,
      };

      SearchService.remove(id);
      updater(prompt);
      const prompts = get().prompts;
      prompts[id] = prompt;
      set(() => ({ prompts }));
      SearchService.add(prompt);

      // 发送全量更新到 API
      fetch("/api/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          Object.values(prompts).map((p) => ({
            title: p.title,
            content: p.content,
          })),
        ),
      });
    },

    search(text: string) {
      if (text.length === 0) {
        // return all rompts
        return this.getUserPrompts().concat(SearchService.builtinPrompts);
      }
      return SearchService.search(text) as Prompt[];
    },
  }),
  {
    name: StoreKey.Prompt,
    version: 3,

    migrate(state, version) {
      const newState = JSON.parse(JSON.stringify(state)) as {
        prompts: Record<string, Prompt>;
      };

      if (version < 3) {
        Object.values(newState.prompts).forEach((p) => (p.id = nanoid()));
      }

      return newState as any;
    },

    onRehydrateStorage(state) {
      // Skip store rehydration on server side
      if (typeof window === "undefined") {
        return;
      }

      const PROMPT_URL = "./prompts.json";

      type PromptList = Array<[string, string]>;

      fetch(PROMPT_URL)
        .then((res) => res.json())
        .then((res) => {
          const builtinPrompts: Prompt[] = (res ?? []).map((prompt: Prompt) => {
            return {
              id: nanoid(),
              title: prompt.title,
              content: prompt.content,
              createdAt: Date.now(),
            } as Prompt;
          });

          const userPrompts = usePromptStore.getState().getUserPrompts() ?? [];

          const allPromptsForSearch = builtinPrompts
            .filter((v) => !!v.title && !!v.content)
            .map((v) => ({ ...v, isUser: true }));
          SearchService.count.builtin = builtinPrompts.length;

          const finalPrompts = [...allPromptsForSearch, ...userPrompts];
          SearchService.init([], finalPrompts);
          usePromptStore.setState({
            prompts: finalPrompts.reduce(
              (pre, cur) => {
                pre[cur.id] = cur;
                return pre;
              },
              {} as Record<string, Prompt>,
            ),
          });
        });
    },
  },
);
