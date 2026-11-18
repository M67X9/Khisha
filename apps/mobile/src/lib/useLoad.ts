import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export type LoadState<T> = { status: "loading" } | { status: "error" } | { status: "ok"; data: T };

/** Runs `loader` every time the screen comes into focus, so lists are fresh after adding, editing or deleting. */
export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    try {
      setState({ status: "ok", data: await loader() });
    } catch {
      setState((s) => (s.status === "ok" ? s : { status: "error" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run]),
  );

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    await run();
  }, [run]);

  return { state, reload };
}
