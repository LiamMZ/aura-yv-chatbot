"use client";

import type { ChatRequestOptions, CreateMessage, Message } from "ai";
import { motion } from "framer-motion";
import type React from "react";
import {
  useRef,
  useEffect,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useState } from "react";

import { cn, sanitizeUIMessages } from "@/lib/utils";

import { ArrowUpIcon, StopIcon } from "./icons";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const studentSuggestedActions = [
  {
    title: "I want funding to help test an idea I have.",
    label: "Where can I get funding?",
    action: "I am a Yale student. I want funding to help test an idea I have. Where can I get funding?",
  },
  {
    title: "Who can I connect with to discuss customer discovery?",
    label: "Connect me with mentors for my venture.",
    action: "I am a Yale student. Who can I connect with to discuss doing customer discovery for my venture?",
  },
  {
    title: "I think I need to talk to a lawyer.",
    label: "Entity formation, patents, hiring contracts, etc - who should I talk to?",
    action: "I am a Yale student. I think I need to talk to a lawyer about entity formation, patents, hiring contracts, etc. Who should I talk to?",
  },
  {
    title: "I want space to build my technology.",
    label: "Where can I find cheap/free lab or prototyping space?",
    action: "I am a Yale student. I want space to build my technology. Where can I find cheap/free lab or prototyping space?",
  },
];

const facultySuggestedActions = [
  {
    title: "How do I commercialize my research?",
    label: "Technology transfer, licensing, and spin-off opportunities.",
    action: "I am a yale faculty. How do I commercialize my research? Technology transfer, licensing, and spin-off opportunities.",
  },
  {
    title: "What funding is available for faculty ventures?",
    label: "Research grants, SBIR, and faculty startup programs.",
    action: "I am a yale faculty. What funding is available for faculty ventures? Research grants, SBIR, and faculty startup programs.",
  },
  {
    title: "Do I need an NDA/MTA before sharing research?",
    label: "Get the right agreement for industry partnerships.",
    action: "I am a yale faculty. Do I need an NDA/MTA before sharing research? Get the right agreement for industry partnerships.",
  },
  {
    title: "Connect me with Yale's innovation ecosystem.",
    label: "Entrepreneurs in Residence, licensing leads, and industry partners.",
    action: "I am a yale faculty. Connect me with Yale's innovation ecosystem. Entrepreneurs in Residence, licensing leads, and industry partners.",
  },
];

type UserProfile = 'student' | 'faculty' | null;

export function MultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  
  // User profile selection
  const [userProfile, setUserProfile] = useLocalStorage<UserProfile>('yale-user-profile', null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    "",
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const submitForm = useCallback(() => {
    handleSubmit(undefined, {});
    setLocalStorageInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [handleSubmit, setLocalStorageInput, width]);

  // Get the appropriate suggested actions based on user profile
  const getSuggestedActions = () => {
    if (userProfile === 'student') return studentSuggestedActions;
    if (userProfile === 'faculty') return facultySuggestedActions;
    return [];
  };

  return (
    <div className="relative w-full flex flex-col gap-4">
      {messages.length === 0 && (
        <>
          {/* User Profile Selection */}
          {!userProfile && (
            <div className="flex flex-col gap-4 w-full" suppressHydrationWarning>
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Welcome to Yale Ventures AI Assistant</h3>
                <p className="text-muted-foreground text-sm">Please select your role to get started:</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 w-full">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Button
                    variant="outline"
                    onClick={() => setUserProfile('student')}
                    className="text-left border-2 rounded-xl px-6 py-8 text-base flex-1 gap-2 flex-col w-full h-full justify-center items-center whitespace-normal hover:border-primary"
                  >
                    <span className="font-medium text-xl">🎓</span>
                    <span className="font-medium">I am a Yale student</span>
                    <span className="text-muted-foreground text-sm text-center">
                      Get help with student entrepreneurship, funding, and ventures
                    </span>
                  </Button>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Button
                    variant="outline"
                    onClick={() => setUserProfile('faculty')}
                    className="text-left border-2 rounded-xl px-6 py-8 text-base flex-1 gap-2 flex-col w-full h-full justify-center items-center whitespace-normal hover:border-primary"
                  >
                    <span className="font-medium text-xl">👨‍🏫</span>
                    <span className="font-medium">I am Yale faculty</span>
                    <span className="text-muted-foreground text-sm text-center">
                      Get help with research commercialization and technology transfer
                    </span>
                  </Button>
                </motion.div>
              </div>
            </div>
          )}

          {/* Suggested Actions - Only show after profile is selected */}
          {userProfile && (
            <div className="flex flex-col gap-4" suppressHydrationWarning>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {userProfile === 'student' ? 'Student Resources' : 'Faculty Resources'}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUserProfile(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Change profile
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 w-full auto-rows-fr">
                {getSuggestedActions().map((suggestedAction, index) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ delay: 0.05 * index }}
                    key={`suggested-action-${suggestedAction.title}-${index}`}
                    className={index > 1 ? "hidden sm:block" : "block"}
                  >
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        append({
                          role: "user",
                          content: suggestedAction.action,
                        });
                      }}
                      className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-2 flex-col w-full h-full justify-start items-start whitespace-normal"
                    >
                      <span className="font-medium text-wrap">{suggestedAction.title}</span>
                      <span className="text-muted-foreground text-wrap whitespace-pre-line">
                        {suggestedAction.label}
                      </span>
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Textarea
        ref={textareaRef}
        placeholder="Send a message..."
        value={input}
        onChange={handleInput}
        className={cn(
          "min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl !text-base bg-muted",
          className,
        )}
        rows={3}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();

            if (isLoading) {
              toast.error("Please wait for the model to finish its response!");
            } else {
              submitForm();
            }
          }
        }}
      />

      {isLoading ? (
        <Button
          className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600"
          onClick={(event) => {
            event.preventDefault();
            stop();
            setMessages((messages) => sanitizeUIMessages(messages));
          }}
        >
          <StopIcon size={14} />
        </Button>
      ) : (
        <Button
          className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border dark:border-zinc-600"
          onClick={(event) => {
            event.preventDefault();
            submitForm();
          }}
          disabled={input.length === 0}
        >
          <ArrowUpIcon size={14} />
        </Button>
      )}
    </div>
  );
}
