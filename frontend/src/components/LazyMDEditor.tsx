import { Suspense, lazy } from "react";

// Lazy load the MD Editor to reduce initial bundle size
const MDEditor = lazy(() => import("@uiw/react-md-editor"));

interface LazyMDEditorProps {
  value?: string;
  onChange?: (val?: string) => void;
  preview?: "live" | "edit" | "preview";
  height?: number;
  "data-color-mode"?: "light" | "dark";
  textareaProps?: {
    placeholder?: string;
    [key: string]: unknown;
  };
}

const LazyMDEditor: React.FC<LazyMDEditorProps> = (props) => {
  return (
    <Suspense
      fallback={
        <div className="border border-border rounded-md p-4 min-h-[200px] flex items-center justify-center bg-surface-sunken">
          <div className="text-text-muted">Loading editor...</div>
        </div>
      }
    >
      <MDEditor {...props} />
    </Suspense>
  );
};

// Also export the Markdown component for viewing
const LazyMarkdown = lazy(() =>
  import("@uiw/react-md-editor").then((module) => ({
    default: module.default.Markdown,
  }))
);

interface LazyMarkdownProps {
  source?: string;
  style?: React.CSSProperties;
}

const LazyMarkdownViewer: React.FC<LazyMarkdownProps> = (props) => {
  return (
    <Suspense
      fallback={<div className="p-2 text-text-muted">Loading content...</div>}
    >
      <LazyMarkdown {...props} />
    </Suspense>
  );
};

export { LazyMDEditor as default, LazyMarkdownViewer };
