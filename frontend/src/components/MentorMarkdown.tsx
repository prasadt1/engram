import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  p: ({ children }) => (
    <p className="mb-2.5 last:mb-0 leading-relaxed text-stone-100">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2.5 last:mb-0 list-disc pl-5 space-y-1.5 text-stone-200">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2.5 last:mb-0 list-decimal pl-5 space-y-1.5 text-stone-200">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="text-stone-300 not-italic">{children}</em>,
  h1: ({ children }) => (
    <h3 className="text-base font-bold text-white mt-3 mb-2 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="text-sm font-bold text-white mt-3 mb-2 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-sm font-semibold text-brand-300 mt-2.5 mb-1.5 first:mt-0">{children}</h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brand-500/60 pl-3 my-2 text-stone-300 italic">
      {children}
    </blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block text-xs font-mono text-brand-200 whitespace-pre-wrap">{children}</code>
      );
    }
    return (
      <code className="px-1 py-0.5 rounded bg-canvas-elevated/80 text-brand-300 text-[0.85em] font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 p-3 rounded-lg bg-canvas-elevated/90 border border-warm overflow-x-auto text-xs">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-400 underline underline-offset-2 hover:text-brand-300"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-warm" />,
};

interface Props {
  content: string;
}

/** Renders mentor/orchestrator replies (often markdown bullets and emphasis). */
export const MentorMarkdown: React.FC<Props> = ({ content }) => (
  <div className="mentor-markdown text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  </div>
);
