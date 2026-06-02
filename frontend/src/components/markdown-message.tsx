"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownMessageProps {
  content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 text-white">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-3 mb-2 text-white">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-3 mb-1.5 text-cyan-100">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-2.5 leading-relaxed text-slate-100">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 ml-1 space-y-1.5 list-none">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-1 space-y-1.5 list-decimal list-inside">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2 text-slate-100 leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
              <span>{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-slate-200 italic">{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-3 border-cyan-400/50 bg-cyan-500/5 px-4 py-2 rounded-r-lg text-slate-200 italic">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <div className="my-3 rounded-xl border border-white/10 bg-[#0a1525] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
                    <span className="text-xs text-slate-400">{className?.replace("language-", "") || "code"}</span>
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm">
                    <code className="text-cyan-100">{children}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code className="rounded-md bg-white/10 px-1.5 py-0.5 text-sm text-cyan-200 font-mono">
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200 transition-colors">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-white/5 text-left text-slate-300">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-white/5 text-slate-200">{children}</td>
          ),
          hr: () => <hr className="my-4 border-white/10" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
