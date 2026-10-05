export type PageQuery = Record<string, unknown>;

type PageHost = {
  $navigateTo?: (pageKey: string, query?: PageQuery) => void;
  $navigateBack?: (times?: number) => void;
  $query?: PageQuery;
};

const host = globalThis as PageHost;

host.$navigateTo = () => {};
host.$navigateBack = () => {};
host.$query = {};

export function installPageNavigation(
  api: {
    navigateTo: (pageKey: string, query?: PageQuery) => void;
    navigateBack: (times?: number) => void;
  } | null,
) {
  if (!api) {
    host.$navigateTo = () => {};
    host.$navigateBack = () => {};
    return;
  }
  host.$navigateTo = (pageKey, query) => {
    api.navigateTo(String(pageKey ?? ''), query);
  };
  host.$navigateBack = (times) => {
    api.navigateBack(times);
  };
}

export function setPageQuery(query: PageQuery) {
  host.$query = query;
}
