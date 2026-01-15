import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export const MarkDownText = ({ content }: { content: string }) => {
  return (
    <div className="prose prose-invert max-w-none text-sm leading-relaxed break-words text-zinc-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // 1. HEADERS: Gradient & Spacing
          h1: ({node, ...props}) => (
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mt-6 mb-3" {...props} />
          ),
          h2: ({node, ...props}) => (
            <h2 className="text-lg font-semibold text-white mt-5 mb-2 border-l-4 border-blue-500 pl-3" {...props} />
          ),
          h3: ({node, ...props}) => (
            <h3 className="text-base font-medium text-blue-200 mt-4 mb-2" {...props} />
          ),
          
          // 2. BOLD: Neon Blue Glow
          strong: ({node, ...props}) => (
            <strong className="font-bold text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" {...props} />
          ),
          
          // 3. ITALIC: Subtle Purple
          em: ({node, ...props}) => (
            <em className="text-purple-300 not-italic" {...props} />
          ),
          
          // 4. LISTS: Custom Bullets
          ul: ({node, ...props}) => (
            <ul className="my-3 space-y-2 pl-2" {...props} />
          ),
          ol: ({node, ...props}) => (
            <ol className="list-decimal pl-5 my-3 space-y-2 text-zinc-400 marker:text-blue-500" {...props} />
          ),
          li: ({node, ...props}) => (
            <li className="relative pl-4 text-zinc-300 group">
              <span className="absolute left-0 top-2 w-1.5 h-1.5 bg-blue-500/50 rounded-full group-hover:bg-blue-400 transition-colors" />
              {props.children}
            </li>
          ),

          // 5. PARAGRAPHS: Better Readability
          p: ({node, ...props}) => (
            <p className="mb-4 last:mb-0 leading-7" {...props} />
          ),
          
          // 6. BLOCKQUOTES: Glass Effect
          blockquote: ({node, ...props}) => (
            <blockquote className="border-l-2 border-purple-500 pl-4 my-4 italic text-zinc-400 bg-purple-500/5 py-2 rounded-r-lg" {...props} />
          ),

          // 7. CODE BLOCKS: Terminal Style
          code: ({node, inline, ...props}: any) => (
            inline 
              ? <code className="bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono border border-blue-500/20" {...props} />
              : <div className="my-4 rounded-lg overflow-hidden border border-white/10 bg-[#0F1016] shadow-inner">
                  <div className="bg-white/5 px-3 py-1.5 text-[10px] text-zinc-500 border-b border-white/5 font-mono uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500/50" />
                    <span className="w-2 h-2 rounded-full bg-yellow-500/50" />
                    <span className="w-2 h-2 rounded-full bg-green-500/50" />
                    Snippet
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <code className="text-xs text-zinc-300 font-mono whitespace-pre" {...props} />
                  </div>
                </div>
          ),
          
          // 8. LINKS: Interactive
          a: ({node, ...props}) => (
            <a className="text-blue-400 hover:text-blue-300 underline underline-offset-4 decoration-blue-500/30 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          
          // 9. HORIZONTAL RULES
          hr: ({node, ...props}) => (
            <hr className="border-white/10 my-6" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};