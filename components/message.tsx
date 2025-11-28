"use client";

import type { Message } from "ai";
import { motion } from "framer-motion";
import React from "react";

import { SparklesIcon } from "./icons";
import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";
import { cn } from "@/lib/utils";
import { Weather } from "./weather";

// Component to render markdown with clickable citation markers
const MarkdownWithCitations = ({ 
  content, 
  onCitationClick, 
  citations 
}: { 
  content: string; 
  onCitationClick?: (citationNumber: number) => void;
  citations?: any[];
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Safe citation processing that won't cause hydration errors
  React.useEffect(() => {
    if (!containerRef.current || !citations?.length) return;

    // Use a safer approach for client-side only execution
    if (typeof window !== 'undefined') {
      // Add a small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        const container = containerRef.current;
        if (!container) return;

        // Simple regex replace approach without DOM manipulation
        const elements = container.querySelectorAll('p, span, div');
        elements.forEach(element => {
          if (element.textContent?.includes('[') && element.textContent?.includes(']')) {
            const newHTML = element.innerHTML.replace(
              /\[(\d+)\]/g,
              '<span class="citation-marker" data-citation="$1" style="color: #2563eb; cursor: pointer; font-weight: 600; text-decoration: underline; font-size: 0.875em; padding: 0 2px; border-radius: 2px; transition: all 0.2s;">[$1]</span>'
            );
            if (newHTML !== element.innerHTML) {
              element.innerHTML = newHTML;
            }
          }
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [content, citations]);

  return (
    <div 
      ref={containerRef}
      className="markdown-with-citations"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('citation-marker')) {
          const citationNumber = parseInt(target.getAttribute('data-citation') || '0');
          if (onCitationClick && citationNumber > 0 && citationNumber <= (citations?.length || 0)) {
            onCitationClick(citationNumber);
            // Visual feedback
            target.style.backgroundColor = '#dbeafe';
            setTimeout(() => {
              target.style.backgroundColor = '';
            }, 200);
          }
        }
      }}
    >
      <style jsx>{`
        .markdown-with-citations :global(.citation-marker:hover) {
          color: #1d4ed8 !important;
          background-color: #eff6ff;
        }
      `}</style>
      <Markdown>{content}</Markdown>
    </div>
  );
};

export const PreviewMessage = ({
  message,
  citations,
  onCitationClick,
}: {
  chatId: string;
  message: Message;
  isLoading: boolean;
  citations?: any[];
  onCitationClick?: (citationNumber: number) => void;
}) => {
  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={message.role}
    >
      <div
        className={cn(
          "group-data-[role=user]/message:bg-primary group-data-[role=user]/message:text-primary-foreground flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
        )}
      >
        {message.role === "assistant" && (
          <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div className="flex flex-col gap-2 w-full">
          {message.content && (
            <div className="flex flex-col gap-4">
              <MarkdownWithCitations 
                content={message.content as string}
                citations={citations}
                onCitationClick={onCitationClick}
              />
            </div>
          )}

          {message.toolInvocations && message.toolInvocations.length > 0 && (
            <div className="flex flex-col gap-4">
              {message.toolInvocations.map((toolInvocation) => {
                const { toolName, toolCallId, state } = toolInvocation;

                if (state === "result") {
                  const { result } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      {toolName === "get_current_weather" ? (
                        <Weather weatherAtLocation={result} />
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
                    </div>
                  );
                }
                return (
                  <div
                    key={toolCallId}
                    className={cn({
                      skeleton: ["get_current_weather"].includes(toolName),
                    })}
                  >
                    {toolName === "get_current_weather" ? <Weather /> : null}
                  </div>
                );
              })}
            </div>
          )}

          {message.experimental_attachments && (
            <div className="flex flex-row gap-2">
              {message.experimental_attachments.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={attachment}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cn(
          "flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
          {
            "group-data-[role=user]/message:bg-muted": true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            <AnimatedThinkingEllipses />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Animated thinking component with multiple animation options
const AnimatedThinking = () => {
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">Thinking</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-muted-foreground rounded-full"
            animate={{
              y: [0, -8, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Alternative animation options (uncomment to use different styles)

// Option 1: Pulsing dots
const AnimatedThinkingPulse = () => (
  <div className="flex items-center gap-2">
    <span className="font-medium">Thinking</span>
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-muted-foreground rounded-full"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  </div>
);

// Option 2: Typing effect
const AnimatedThinkingTyping = () => (
  <div className="flex items-center gap-2">
    <span className="flex items-center gap-2">
      <span className="font-medium">Thinking</span>
      <motion.div
        className="w-2 h-2 bg-muted-foreground rounded-full"
        animate={{
          opacity: [1, 0],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </span>
  </div>
);

// Option 3: Wave effect
const AnimatedThinkingWave = () => {
  console.log("AnimatedThinkingWave component rendering");
  
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">Thinking</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => {
          console.log(`Rendering wave bar ${i}`);
          return (
            <motion.div
              key={i}
              style={{
                width: '4px',
                height: '24px',
                backgroundColor: 'hsl(var(--muted-foreground))',
                borderRadius: '50%',
                border: '1px solid red', // Debug border
              }}
              initial={{ height: 24, opacity: 0.3 }}
              animate={{
                height: [24, 32, 24],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
              onAnimationStart={() => console.log(`Animation started for bar ${i}`)}
              onAnimationComplete={() => console.log(`Animation completed for bar ${i}`)}
            />
          );
        })}
      </div>
    </div>
  );
};

// Fallback CSS-only wave animation (in case framer-motion has issues)
const AnimatedThinkingWaveCSS = () => {
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">Thinking</span>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-0.5 h-2 bg-muted-foreground rounded-full"
            style={{
              animation: `wave 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Alternative: Animated ellipses with wave motion
const AnimatedThinkingEllipses = () => {
  return (
    <div className="flex items-baseline gap-1">
      <span className="font-medium">Thinking</span>
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1 h-1 bg-muted-foreground rounded-full"
            style={{
              animation: `ellipseWave 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
