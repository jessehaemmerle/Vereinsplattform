"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex">
      <input
        readOnly
        value={value}
        aria-label="Link"
        className="border-line bg-paper min-w-0 flex-1 rounded-l-md border px-3 py-2 font-mono text-xs"
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="border-line bg-surface text-muted hover:text-loden rounded-r-md border border-l-0 px-3"
        aria-label="Link kopieren"
      >
        {copied ? <Check className="text-ok size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
