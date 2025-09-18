"use client";

import { PreviewMessage, ThinkingMessage } from "@/components/message";
import { MultimodalInput } from "@/components/multimodal-input";
import { Overview } from "@/components/overview";
import { FeedbackButton } from "@/components/feedback-button";
import { ArtifactWidget, convertBackendCitations } from "@/components/artifact-widget";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { ToolInvocation } from "ai";
import { useChat } from "ai/react";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";

// Cookie utilities
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

const setCookie = (name: string, value: string, days: number = 30) => {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  // Only add Secure flag for HTTPS
  const isSecure = window.location.protocol === 'https:';
  const secureFlag = isSecure ? ';Secure' : '';
  const cookieString = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax${secureFlag}`;
  
  console.log("Setting cookie with string:", cookieString);
  document.cookie = cookieString;
  
  // Verify cookie was set with a small delay to ensure it's written
  setTimeout(() => {
    const verification = getCookie(name);
    console.log("Cookie verification - expected:", value, "actual:", verification);
  }, 100);
};

const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

export function Chat() {
  const chatId = "001";
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cookieConsent, setCookieConsent] = useState<boolean | null>(null);
  const [showResetButton, setShowResetButton] = useState(false);
  const [pendingCitations, setPendingCitations] = useState<any[]>([]);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [messageCitations, setMessageCitations] = useState<Record<string, any[]>>({});
  const [backendCitationsLoaded, setBackendCitationsLoaded] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);



  const createNewSession = useCallback(async () => {
    try {
      console.log("Creating new session...");
      
      // Determine which API to use based on environment
      // Always use relative URLs to go through Next.js rewrites
      // This avoids CORS issues and uses the BACKEND_URL from next.config.js
      const apiUrl = '';
      
      const response = await fetch(`${apiUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_agent: navigator.userAgent,
          initial_context: {}
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Session created:", data);
        setSessionId(data.session_id);
        
        // Note: Session will be auto-stored in cookie by useEffect if consent is given
        console.log("Session created, cookie consent status:", cookieConsent);
      } else {
        const errorText = await response.text();
        console.error("Session creation failed:", response.status, errorText);
        
        // Fallback: try local Next.js API if backend fails
        if (!response.ok && response.status >= 500) {
          console.log("Trying local Next.js API fallback...");
          const fallbackResponse = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_agent: navigator.userAgent,
              initial_context: {}
            })
          });
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log("Session created via fallback:", fallbackData);
            setSessionId(fallbackData.session_id);
          }
        }
      }
    } catch (error) {
      console.error("Failed to create session:", error);
      
      // Final fallback: try local Next.js API
      try {
        console.log("Trying local Next.js API as final fallback...");
        const fallbackResponse = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_agent: navigator.userAgent,
            initial_context: {}
          })
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log("Session created via final fallback:", fallbackData);
          setSessionId(fallbackData.session_id);
        }
      } catch (fallbackError) {
        console.error("All session creation methods failed:", fallbackError);
      }
    }
  }, [cookieConsent]);

  const handleCookieConsent = async (accepted: boolean) => {
    console.log("=== HANDLING COOKIE CONSENT ===");
    console.log("Cookie consent given:", accepted);
    console.log("Before setting consent - all cookies:", document.cookie);
    
    setCookieConsent(accepted);
    setCookie('cookie-consent', accepted ? 'accepted' : 'declined', 365);
    console.log("Set cookie consent cookie to:", accepted ? 'accepted' : 'declined');
    
    // Verify the cookie was actually set
    setTimeout(() => {
      console.log("After setting consent - all cookies:", document.cookie);
      const verification = getCookie('cookie-consent');
      console.log("Cookie consent verification:", verification);
    }, 200);
    
    if (accepted) {
      // Store current session in cookie if we have one, otherwise create new session
      if (sessionId) {
        setCookie('yale-ventures-session', sessionId, 30);
        console.log("Stored existing session in cookie:", sessionId);
      } else {
        // Create new session since user just accepted cookies and we don't have one yet
        console.log("No session available - creating new session after consent");
        await createNewSession();
      }
    } else {
      // Remove session cookie if declined
      deleteCookie('yale-ventures-session');
      console.log("Deleted session cookie");
    }
  };

  const resetConversation = async () => {
    if (sessionId) {
      try {
        // Use relative URLs to go through Next.js rewrites
        const apiUrl = '';
        
        const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/reset`, {
          method: 'POST'
        });
        
        if (response.ok) {
          console.log("Conversation reset successfully");
          setMessages([]);
          setPendingCitations([]);
          setMessageCitations({});
          setCurrentMessageId(null);
        } else {
          console.error("Failed to reset conversation");
        }
      } catch (error) {
        console.error("Error resetting conversation:", error);
      }
    }
  };

  const clearChat = async () => {
    console.log("Clearing chat and citations...");
    
    // First, clear the frontend state immediately for responsive UI
    setMessages([]);
    setPendingCitations([]);
    setMessageCitations({});
    setCurrentMessageId('');
    
    // Clear session cookie and reset cookie consent
    console.log("Clearing session cookie and resetting cookie consent...");
    deleteCookie('yale-ventures-session');
    setSessionId(null);
    setCookieConsent(null);
    
    // Then, reset the backend session to ensure conversation is truly cleared
    if (sessionId) {
      try {
        console.log("Resetting backend session:", sessionId);
        await resetConversation();
        console.log("Backend session reset successfully");
        
        // Ensure we clear any cached citation data for this session 
        // (in case there are any lingering references)
        setMessageCitations({});
        setPendingCitations([]);
        
      } catch (error) {
        console.error("Failed to reset backend session:", error);
        // Note: We still keep the frontend cleared even if backend fails
        // Show user feedback about the error
        console.warn("Frontend cleared but backend reset failed. The conversation should still be cleared on page reload.");
      }
    } else {
      console.warn("No session ID available - only frontend cleared");
    }
    
    console.log("Chat, citations, cookie, and consent cleared completely");
  };

  // Load citation history for existing session
  const loadCitationHistory = async (sessionId: string) => {
    console.log("🔄 loadCitationHistory called for session:", sessionId);
    try {
      // Always use relative URLs to go through Next.js rewrites
      // This avoids CORS issues and uses the BACKEND_URL from next.config.js
      const apiUrl = '';
      
      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/messages`);
      if (response.ok) {
        const data = await response.json();
        console.log("Loaded session messages:", data);
        
        // Convert backend messages to frontend format and load them
        const frontendMessages = [];
        const citationsMap: Record<string, any[]> = {};
        
        // Process messages and group citations by message content hash
        for (let i = 0; i < data.messages.length; i++) {
          const message = data.messages[i];
          
          // Convert backend message to frontend Message format
          const frontendMessage = {
            id: message.id,
            role: message.role as 'user' | 'assistant',
            content: message.content,
            createdAt: new Date(message.created_at)
          };
          frontendMessages.push(frontendMessage);
          
          // Load citations for assistant messages
          if (message.role === 'assistant' && message.citations_count > 0) {
            try {
              const citationResponse = await fetch(`${apiUrl}/api/messages/${message.id}/citations`);
              if (citationResponse.ok) {
                const citationData = await citationResponse.json();
                console.log(`Citations for message ${message.id}:`, citationData);
                
                if (citationData.citations && citationData.citations.length > 0) {
                  const formattedCitations = citationData.citations.map((citation: any) => ({
                    rank: citation.rank,
                    document: citation.document,
                    relevance_score: citation.relevance_score,
                    content: citation.content,
                    metadata: citation.metadata,
                    messageId: citation.message_id,
                    userMessage: citation.message_content,
                    aiResponse: citation.message_role === 'assistant' ? citation.message_content : ''
                  }));
                  
                  // Store citations using both the backend message ID and content hash for fallback
                  citationsMap[message.id] = formattedCitations;
                  
                  // Create content hash as fallback key for matching with frontend messages
                  const contentHash = message.content.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
                  citationsMap[`content_${contentHash}`] = formattedCitations;
                  
                  console.log(`Stored ${formattedCitations.length} citations for message ${message.id}`);
                }
              }
            } catch (err) {
              console.warn('Failed to load citations for message:', err);
            }
          }
        }
        
        // Note: We can't directly setMessages because useChat manages its own state
        // Instead, we'll rely on the citation mapping to work with whatever messages exist
        console.log(`Found ${frontendMessages.length} backend messages, citations mapped by content hash`);
        
        console.log("📊 Final citations map:", citationsMap);
        console.log("📊 Citations map keys:", Object.keys(citationsMap));
        console.log("📊 Total citations loaded:", Object.values(citationsMap).flat().length);
        setMessageCitations(citationsMap);
        setBackendCitationsLoaded(true);
        console.log("✅ Backend citations loaded successfully");
      }
    } catch (error) {
      console.warn('Failed to load citation history:', error);
    }
  };



  // Key combination to show reset button (Ctrl+Shift+R)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setShowResetButton(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Effect to store session in cookie when both sessionId and consent are available
  useEffect(() => {
    if (sessionId && cookieConsent === true) {
      const existingSessionCookie = getCookie('yale-ventures-session');
      if (!existingSessionCookie || existingSessionCookie !== sessionId) {
        setCookie('yale-ventures-session', sessionId, 30);
        console.log("Auto-stored session in cookie after consent:", sessionId);
      }
    }
  }, [sessionId, cookieConsent]);

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
  } = useChat({
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const body = JSON.parse(init?.body as string || '{}');
      const lastMessage = body.messages?.[body.messages.length - 1];
      
      if (lastMessage) {
        // Wait for hydration and session to be created if it's not ready yet
        if (!isHydrated || !sessionId) {
          console.log("Session not ready, waiting...");
          toast.error("Session not ready. Please wait a moment and try again.");
          throw new Error("Session not ready");
        }
        
        console.log("Using session:", sessionId);
        
        // Convert AI SDK format to backend format
        const backendBody = {
          session_id: sessionId,
          message: lastMessage.content
        };
        
        console.log("Sending request:", backendBody);
        
        // Use relative URLs to go through Next.js rewrites
        const apiUrl = '';
        
        const response = await fetch(`${apiUrl}/api/chat`, {
          ...init,
          body: JSON.stringify(backendBody)
        });
        
        console.log("Response status:", response.status);
        
        if (response.ok) {
          // Check if response is already streaming (has the right content-type)
          const contentType = response.headers.get('content-type');
          if (contentType === 'text/plain' && response.headers.get('x-vercel-ai-data-stream') === 'v1') {
            // Response is already in streaming format, pass it through
            console.log("Received streaming response from backend");
            return response;
          } else {
            // Fallback: convert JSON response to streaming format
            const data = await response.json();
            console.log("Response data:", data);
            
            // Store citations for display
            if (data.citations && Array.isArray(data.citations) && data.citations.length > 0) {
              console.log("=== CITATIONS RECEIVED FROM BACKEND ===");
              console.log("Raw citations data:", data.citations);
              console.log("Citations count:", data.citations.length);
              
              const formattedCitations = convertBackendCitations(data.citations);
              console.log("Formatted citations:", formattedCitations);
              
              // Store citations with response content hash for reliable matching
              const responseContent = data.response || '';
              const contentHash = responseContent.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
              
              const enhancedCitations = formattedCitations.map(citation => ({
                ...citation,
                userMessage: messages[messages.length - 1]?.content || 'Previous question', // Get user's question
                aiResponse: responseContent // Store the AI's response
              }));
              
              // Store citations immediately using content hash
              const contentKey = `content_${contentHash}`;
              setMessageCitations(prev => {
                const updated = { ...prev, [contentKey]: enhancedCitations };
                console.log(`Stored citations with content key: ${contentKey}`, updated);
                return updated;
              });
              
              // Display citations immediately
              setPendingCitations(enhancedCitations);
              console.log("Enhanced citations stored immediately:", enhancedCitations);
              
              // Try to link to the actual AI message when it becomes available
              let retryCount = 0;
              const maxRetries = 10;
              
              const linkCitationsToMessage = () => {
                setTimeout(() => {
                  // Look for a message with matching content
                  const matchingMessage = messages.find((msg: any) => 
                    msg.role === 'assistant' && 
                    msg.content && 
                    responseContent.length > 100 &&
                    msg.content.includes(responseContent.substring(0, 100))
                  );
                  
                  if (matchingMessage && matchingMessage.id) {
                    console.log(`Found matching AI message with ID: ${matchingMessage.id}`);
                    
                    // Store citations with the actual message ID
                    setMessageCitations(prev => {
                      const updated = { ...prev };
                      updated[matchingMessage.id] = enhancedCitations.map(citation => ({
                        ...citation,
                        messageId: matchingMessage.id
                      }));
                      console.log(`Linked citations to message ID ${matchingMessage.id}:`, updated);
                      return updated;
                    });
                    
                    // Clear pending citations since they're now properly stored
                    setPendingCitations([]);
                    console.log(`Successfully linked citations to AI message: ${matchingMessage.id}`);
                  } else if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`Retry ${retryCount}/${maxRetries}: AI message not found yet, retrying...`);
                    linkCitationsToMessage();
                  } else {
                    console.log(`Max retries reached. Keeping citations with content key: ${contentKey}`);
                  }
                }, 100 * (retryCount + 1)); // Exponential backoff
              };
              
              linkCitationsToMessage();
            } else {
              console.log("=== NO CITATIONS IN BACKEND RESPONSE ===");
              console.log("Response data keys:", Object.keys(data));
              console.log("Citations field:", data.citations);
              console.log("Response field:", data.response);
              console.log("Full response data:", data);
            }
            
            // Sync user data extracted by backend to frontend database
            try {
              console.log("Syncing user data from backend response...");
              
              // First, get the current backend session data to extract user info
              const backendSessionResponse = await fetch(`${apiUrl}/api/sessions/${sessionId}`);
              if (backendSessionResponse.ok) {
                const backendSessionData = await backendSessionResponse.json();
                console.log("Backend session data:", backendSessionData);
                
                // Sync the data to frontend database
                const syncResponse = await fetch('/api/sessions/sync-data', {
                  method: 'GET',
                  headers: { 'Content-Type': 'application/json' }
                });
                
                if (syncResponse.ok) {
                  const syncResult = await syncResponse.json();
                  console.log("User data sync result:", syncResult);
                } else {
                  console.warn("Failed to sync user data:", await syncResponse.text());
                }
              } else {
                console.warn("Failed to fetch backend session data for sync");
              }
            } catch (syncError) {
              console.warn("User data sync failed:", syncError);
              // Don't let sync failures break the chat flow
            }
            
            // Create a simple streaming response that the AI SDK can handle
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              start(controller) {
                // Send the content in the correct AI SDK format
                controller.enqueue(encoder.encode(`0:${JSON.stringify(data.response)}\n`));
                controller.enqueue(encoder.encode(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0},"isContinued":false}\n`));
                controller.close();
              }
            });
            
            return new Response(stream, {
              headers: { 
                'content-type': 'text/plain',
                'x-vercel-ai-data-stream': 'v1' 
              }
            });
          }
        } else {
          const errorText = await response.text();
          console.error("API Error:", response.status, errorText);
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
      }
      
      return fetch(url, init);
    },
    maxSteps: 4,
    onError: (error: Error) => {
      if (error.message.includes("Too many requests")) {
        toast.error(
          "You are sending too many messages. Please try again later.",
        );
      }
    },
    onFinish: (message: any) => {
      // Store citations for the last assistant message if available
      if (message.role === 'assistant' && message.id && message.content) {
        console.log("Message finished:", message.id, message.content);
        
        // Try to link any pending citations to this message
        setTimeout(() => {
          const messageContent = message.content || '';
          const contentHash = messageContent.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
          const contentKey = `content_${contentHash}`;
          
          setMessageCitations(prev => {
            const updated = { ...prev };
            
            // If we have citations stored with content hash, link them to the message ID
            if (updated[contentKey]) {
              const citations = updated[contentKey];
              updated[message.id] = citations.map(citation => ({
                ...citation,
                messageId: message.id
              }));
              console.log(`onFinish: Linked citations from ${contentKey} to message ID ${message.id}`);
            }
            
            return updated;
          });
          
          // Clear pending citations if they match this message
          setPendingCitations(prev => {
            const shouldClear = prev.some(citation => 
              citation.aiResponse && messageContent.includes(citation.aiResponse.substring(0, 100))
            );
            if (shouldClear) {
              console.log("onFinish: Cleared pending citations for message", message.id);
              return [];
            }
            return prev;
          });
        }, 100);
      }
    }
  });

  // Hydration effect - run immediately on mount
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Check for existing session and cookie consent on mount - run only once after hydration
  useEffect(() => {
    if (!isHydrated) return; // Wait for hydration
    
    let hasInitialized = false;
    
    const checkExistingSession = async () => {
      if (hasInitialized) return;
      hasInitialized = true;
      
      console.log("=== INITIALIZING APP ===");
      console.log("All cookies:", document.cookie);
      
      // Check if we should clear chat (coming from admin page)
      const urlParams = new URLSearchParams(window.location.search);
      const shouldClear = urlParams.get('clear') === 'true';
      
      if (shouldClear) {
        console.log("Clear parameter detected, clearing chat and creating new session");
        // Clear URL parameter
        window.history.replaceState({}, document.title, window.location.pathname);
        // Clear any existing session cookie
        deleteCookie('yale-ventures-session');
        // Clear messages
        setMessages([]);
        // Create new session directly without dependency
        try {
          const response = await fetch(`/api/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_agent: navigator.userAgent,
              initial_context: {}
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log("Session created:", data);
            setSessionId(data.session_id);
          }
        } catch (error) {
          console.error("Session creation failed:", error);
        }
        return;
      }
      
      // Check cookie consent first
      const consentValue = getCookie('cookie-consent');
      console.log("Cookie consent value found:", consentValue);
      
      if (consentValue) {
        // Only set consent state if user has previously made a choice
        const hasConsent = consentValue === 'accepted';
        console.log("Found existing consent, setting to:", hasConsent);
        setCookieConsent(hasConsent);
        
        if (hasConsent) {
          // Try to restore existing session from cookie
          const existingSessionId = getCookie('yale-ventures-session');
          console.log("Existing session ID from cookie:", existingSessionId);
          if (existingSessionId) {
            // Validate session is still active - try backend first
            try {
              let response = await fetch(`/api/sessions/${existingSessionId}`);
              
              if (response.ok) {
                console.log("Restored existing session:", existingSessionId);
                setSessionId(existingSessionId);
                
                // Try to restore conversation history
                try {
                  const historyResponse = await fetch(`/api/sessions/${existingSessionId}/history`);
                  if (historyResponse.ok) {
                    const historyData = await historyResponse.json();
                    if (historyData.messages && historyData.messages.length > 0) {
                      setMessages(historyData.messages);
                      console.log("Restored conversation history:", historyData.messages.length, "messages");
                    }
                  }
                } catch (historyError) {
                  console.log("Failed to restore conversation history:", historyError);
                }
                
                // Load citation history for existing session
                await loadCitationHistory(existingSessionId);
                
                return; // Exit early - don't create new session
              } else {
                // Session expired, remove cookie
                console.log("Session not found or expired, removing cookie");
                deleteCookie('yale-ventures-session');
              }
            } catch (error) {
              console.log("Session validation failed:", error);
              deleteCookie('yale-ventures-session');
            }
          }
          
          // Create new session directly if user has consented and no valid session exists
          try {
            const response = await fetch(`/api/sessions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_agent: navigator.userAgent,
                initial_context: {}
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log("Session created:", data);
              setSessionId(data.session_id);
            }
          } catch (error) {
            console.error("Session creation failed:", error);
          }
        } else {
          // User declined cookies - create temporary session (not stored in cookies)
          console.log("User declined cookies - creating temporary session");
          try {
            const response = await fetch(`/api/sessions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_agent: navigator.userAgent,
                initial_context: {}
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log("Temporary session created:", data);
              setSessionId(data.session_id);
            }
          } catch (error) {
            console.error("Temporary session creation failed:", error);
          }
        }
      } else {
        console.log("No consent cookie found - banner should show");
        // Don't create a session yet - wait for user consent
      }
    };

    checkExistingSession();
  }, [isHydrated]); // Run once after hydration

  const [messagesContainerRef, messagesEndRef, scrollToBottom] =
    useScrollToBottom<HTMLDivElement>();


  // Custom submit handler that scrolls to bottom when user sends a message
  const handleCustomSubmit = useCallback((
    event?: { preventDefault?: () => void },
    chatRequestOptions?: any
  ) => {
    // Clear previous citations when user sends a new message
    setPendingCitations([]);
    
    handleSubmit(event, chatRequestOptions);
    // Scroll to bottom when user sends a message
    setTimeout(() => scrollToBottom(), 100);
  }, [handleSubmit, scrollToBottom]);

  return (
    <div className="flex flex-col min-w-0 h-[calc(100dvh-52px)] bg-background relative">
      {/* Cookie Consent Banner */}
      {isHydrated && cookieConsent === null && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              <p>
                We use cookies to remember your conversation and improve your experience. 
                <span className="font-medium"> No personal data is stored or shared.</span>
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleCookieConsent(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Decline
              </button>
              <button
                onClick={() => handleCookieConsent(true)}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Reset Button (Ctrl+Shift+R to toggle) */}
      {showResetButton && (
        <div className="fixed top-4 right-4 z-40">
          <button
            onClick={resetConversation}
            className="px-3 py-2 text-xs bg-red-600 text-white rounded-md shadow-lg hover:bg-red-700 transition-colors"
            title="Reset conversation (for testing)"
          >
            Reset Chat
          </button>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 relative"
      >
        {messages.length === 0 && <Overview />}

        {/* Clear Chat Button - shown when there are messages */}
        {messages.length > 0 && (
          <div className="absolute top-4 right-4 z-30 flex gap-2">
            <button
              onClick={clearChat}
              className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 flex items-center gap-2"
              title="Clear conversation"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Chat
            </button>
          </div>
        )}

        {messages.map((message: any, index: number) => (
          <div key={message.id} className="message-container" data-message-id={message.id}>
            <PreviewMessage
              chatId={chatId}
              message={message}
              isLoading={isLoading && messages.length - 1 === index}
              citations={(() => {
                // Get citations for this message using the same logic as before
                const directCitations = messageCitations[message.id];
                const contentHash = message.content?.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
                const contentCitations = messageCitations[`content_${contentHash}`];
                
                // Also try content matching for robustness
                let matchedCitations = null;
                if (!directCitations && !contentCitations && message.content) {
                  for (const [key, citations] of Object.entries(messageCitations)) {
                    if (citations.length > 0 && citations[0].aiResponse) {
                      const storedResponseStart = citations[0].aiResponse.substring(0, 200);
                      const currentMessageStart = message.content.substring(0, 200);
                      
                      if (storedResponseStart && currentMessageStart && 
                          storedResponseStart === currentMessageStart) {
                        matchedCitations = citations;
                        break;
                      }
                    }
                  }
                }
                
                return directCitations || contentCitations || matchedCitations;
              })()}
              onCitationClick={(citationNumber) => {
                // Handle citation clicks - find which consolidated citation contains this original citation number
                const citations = (() => {
                  const directCitations = messageCitations[message.id];
                  const contentHash = message.content?.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
                  const contentCitations = messageCitations[`content_${contentHash}`];
                  
                  let matchedCitations = null;
                  if (!directCitations && !contentCitations && message.content) {
                    for (const [key, citationList] of Object.entries(messageCitations)) {
                      if (citationList.length > 0 && citationList[0].aiResponse) {
                        const storedResponseStart = citationList[0].aiResponse.substring(0, 200);
                        const currentMessageStart = message.content.substring(0, 200);
                        
                        if (storedResponseStart && currentMessageStart && 
                            storedResponseStart === currentMessageStart) {
                          matchedCitations = citationList;
                          break;
                        }
                      }
                    }
                  }
                  
                  return directCitations || contentCitations || matchedCitations || [];
                })();

                // Find which consolidated citation contains the clicked original citation number
                let targetConsolidatedIndex = -1;
                const originalCitation = citations.find(c => c.rank === citationNumber);
                if (originalCitation) {
                  // Group citations by document (same logic as ArtifactWidget)
                  const documentGroups: { [key: string]: any[] } = {};
                  citations.forEach(citation => {
                    const docKey = citation.document || 'Unknown Document';
                    if (!documentGroups[docKey]) {
                      documentGroups[docKey] = [];
                    }
                    documentGroups[docKey].push(citation);
                  });

                  // Find which group contains our target citation
                  const sortedGroups = Object.entries(documentGroups)
                    .map(([document, citationGroup]) => ({
                      document,
                      citationGroup: citationGroup.sort((a, b) => a.rank - b.rank),
                      avgRelevance: citationGroup.reduce((sum, c) => sum + (c.relevance_score || 0), 0) / citationGroup.length
                    }))
                    .sort((a, b) => b.avgRelevance - a.avgRelevance);

                  targetConsolidatedIndex = sortedGroups.findIndex(group => 
                    group.citationGroup.some(c => c.rank === citationNumber)
                  );
                }

                // Scroll to and highlight the consolidated citation
                const citationWidgets = document.querySelectorAll('.artifact-widget');
                const targetWidget = Array.from(citationWidgets).find(widget => {
                  const messageElement = widget.closest('.message-container') || widget.parentElement?.parentElement;
                  return messageElement?.querySelector(`[data-message-id="${message.id}"]`);
                });
                
                if (targetWidget && targetConsolidatedIndex >= 0) {
                  targetWidget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Highlight the specific consolidated citation
                  const citationCards = targetWidget.querySelectorAll('.citation-card');
                  const targetCard = citationCards[targetConsolidatedIndex];
                  if (targetCard) {
                    targetCard.classList.add('highlighted');
                    setTimeout(() => targetCard.classList.remove('highlighted'), 2000);
                    // Auto-expand the citation to show content
                    (targetCard as HTMLElement).click();
                  }
                }
              }}
            />
            
            {/* Show citations for AI responses */}
            {message.role === 'assistant' && (() => {
              // Try multiple ways to find citations for this message
              const directCitations = messageCitations[message.id];
              const contentHash = message.content.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
              const contentCitations = messageCitations[`content_${contentHash}`];
              
              // Also try to find citations by matching content from any stored citation
              let matchedCitations = null;
              if (!directCitations && !contentCitations && message.content) {
                for (const [key, citations] of Object.entries(messageCitations)) {
                  if (citations.length > 0 && citations[0].aiResponse) {
                    // Check if the AI response content matches (first 200 chars)
                    const storedResponseStart = citations[0].aiResponse.substring(0, 200);
                    const currentMessageStart = message.content.substring(0, 200);
                    
                    if (storedResponseStart && currentMessageStart && 
                        storedResponseStart === currentMessageStart) {
                      console.log(`Found matching citations by content for message ${message.id} using key ${key}`);
                      matchedCitations = citations;
                      break;
                    }
                  }
                }
              }
              
              const citations = directCitations || contentCitations || matchedCitations;
              
              
              return citations && citations.length > 0 ? (
                <div className="w-full mx-auto max-w-3xl px-4 mb-4">
                  <ArtifactWidget 
                    citations={citations}
                    title="Sources for this response"
                    className="max-w-full"
                  />
                </div>
              ) : null;
            })()}
            
          </div>
        ))}

        {/* Show pending citations immediately after messages */}
        {pendingCitations.length > 0 && (
          <div className="w-full mx-auto max-w-3xl px-4 mb-4">
            <ArtifactWidget 
              citations={pendingCitations}
              title="Sources for this response"
              className="max-w-full"
            />
          </div>
        )}
        

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && <ThinkingMessage />}

        <div
          ref={messagesEndRef}
          className="shrink-0 min-w-[24px] min-h-[24px]"
        />
      </div>

      <form className={`flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl ${isHydrated && cookieConsent === null ? 'mb-20' : ''}`}>
        <MultimodalInput
          chatId={chatId}
          input={input}
          setInput={setInput}
          handleSubmit={handleCustomSubmit}
          isLoading={isLoading}
          stop={stop}
          messages={messages}
          setMessages={setMessages}
          append={append}
        />
      </form>
      
      {/* Beta Notice */}
      <div className="text-center px-4 pb-4 text-xs text-muted-foreground max-w-3xl mx-auto">
        <p>
          <span className="font-semibold">⚠️ Beta Notice</span>
        </p>
        <p className="mt-1">
          This AI assistant is currently in beta. While it&apos;s designed to be helpful and informed by Yale Ventures resources, it may occasionally provide incomplete or outdated responses. Always double-check critical information, and don&apos;t hesitate to contact the Yale Ventures team directly if you need more support.
        </p>
      </div>
      
      {/* Footer Banner */}
      <div className="bg-gray-100 border-t text-center py-2 text-xs text-gray-600">
        Built by Aura AI
      </div>
      
      {/* Feedback Button - Fixed positioning in lower right corner */}
      <FeedbackButton sessionId={sessionId} />
    </div>
  );
}
