import { Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';

const AIResponseRenderer = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [text]);

  if (!text) return null;

  // Parse the text into structured blocks
  const lines = text.split('\n');
  const blocks = [];
  let currentBlock = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Heading patterns: **Heading:** or ## Heading or ### Heading
    const boldHeading = trimmed.match(/^\*\*(.+?)[:：]\*\*\s*$/);
    const mdHeading = trimmed.match(/^#{1,4}\s+(.+)$/);
    const colonHeading = trimmed.match(/^([A-Z][A-Za-z\s\-—()]+)[:：]\s*$/);

    if (boldHeading || mdHeading || colonHeading) {
      const title = (boldHeading && boldHeading[1]) || (mdHeading && mdHeading[1]) || (colonHeading && colonHeading[1]);
      currentBlock = { type: 'section', title: title.replace(/\*\*/g, ''), items: [] };
      blocks.push(currentBlock);
    } else if (trimmed.match(/^[-•]\s+/)) {
      // Bullet point
      const content = trimmed.replace(/^[-•]\s+/, '');
      if (currentBlock && currentBlock.type === 'section') {
        currentBlock.items.push({ type: 'bullet', text: content });
      } else {
        currentBlock = { type: 'section', title: null, items: [{ type: 'bullet', text: content }] };
        blocks.push(currentBlock);
      }
    } else if (trimmed.match(/^\d+[.)]\s+/)) {
      // Numbered item
      const content = trimmed.replace(/^\d+[.)]\s+/, '');
      if (currentBlock && currentBlock.type === 'section') {
        currentBlock.items.push({ type: 'numbered', text: content });
      } else {
        currentBlock = { type: 'section', title: null, items: [{ type: 'numbered', text: content }] };
        blocks.push(currentBlock);
      }
    } else if (trimmed === '') {
      currentBlock = null;
    } else {
      // Plain paragraph
      if (currentBlock && currentBlock.type === 'section') {
        currentBlock.items.push({ type: 'paragraph', text: trimmed });
      } else {
        blocks.push({ type: 'paragraph', text: trimmed });
      }
    }
  }

  const renderInlineFormatting = (str) => {
    // Handle **bold** and *italic*
    const parts = [];
    let remaining = str;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.substring(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={key++} className="text-white font-semibold">{boldMatch[1]}</strong>);
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }
    return parts;
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, bi) => {
        if (block.type === 'paragraph') {
          return (
            <p key={bi} className="text-sm text-slate-200 leading-relaxed">
              {renderInlineFormatting(block.text)}
            </p>
          );
        }

        if (block.type === 'section') {
          return (
            <div key={bi} className="space-y-1.5">
              {block.title && (
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  {block.title}
                </h4>
              )}
              {block.items.map((item, ii) => {
                if (item.type === 'bullet') {
                  return (
                    <div key={ii} className="flex items-start gap-2 text-sm text-slate-200 leading-relaxed pl-1">
                      <span className="text-blue-400 mt-1.5 w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                      <span>{renderInlineFormatting(item.text)}</span>
                    </div>
                  );
                }
                if (item.type === 'numbered') {
                  return (
                    <div key={ii} className="flex items-start gap-2 text-sm text-slate-200 leading-relaxed pl-1">
                      <span className="text-blue-400 font-mono text-xs mt-0.5 flex-shrink-0 w-4 text-right">{ii + 1}.</span>
                      <span>{renderInlineFormatting(item.text)}</span>
                    </div>
                  );
                }
                return (
                  <p key={ii} className="text-sm text-slate-200 leading-relaxed">
                    {renderInlineFormatting(item.text)}
                  </p>
                );
              })}
            </div>
          );
        }

        return null;
      })}

      {/* Copy button */}
      <div className="pt-1">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Copy response to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy response
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AIResponseRenderer;
