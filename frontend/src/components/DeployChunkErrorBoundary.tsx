import { Component, type ErrorInfo, type ReactNode } from "react";

const RELOAD_FLAG = "npc_chunk_reload";

function isStaleChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { reloading: boolean; failed: boolean };

/**
 * After a Render deploy, hashed Vite chunks from the previous build 404.
 * One automatic full reload picks up the new index.html + assets.
 */
export class DeployChunkErrorBoundary extends Component<Props, State> {
  state: State = { reloading: false, failed: false };

  static getDerivedStateFromError(): Partial<State> {
    return { reloading: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (!isStaleChunkError(error)) {
      this.setState({ reloading: false, failed: true });
      return;
    }
    try {
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        return;
      }
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* ignore */
    }
    this.setState({ reloading: false, failed: true });
  }

  render() {
    if (this.state.failed) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex items-center justify-center p-6 text-center">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                Trang cần tải lại sau khi cập nhật
              </p>
              <button
                type="button"
                className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-white"
                onClick={() => {
                  try {
                    sessionStorage.removeItem(RELOAD_FLAG);
                  } catch {
                    /* ignore */
                  }
                  window.location.reload();
                }}
              >
                Tải lại trang
              </button>
            </div>
          </div>
        )
      );
    }
    if (this.state.reloading) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

/** Call once on boot so a successful load clears the one-shot reload guard. */
export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}
