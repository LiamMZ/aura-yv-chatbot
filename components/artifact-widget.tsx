"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { 
  FileText, 
  ExternalLink, 
  Download, 
  Eye, 
  ChevronDown, 
  ChevronUp,
  BookOpen,
  Link as LinkIcon,
  Star,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Citation {
  rank: number;
  document: string;
  relevance_score: number;
  content: string;
  metadata?: {
    source_url?: string;
    file_path?: string;
    doc_type?: string;
    notion_url?: string;
    download_url?: string;
    page_title?: string;
    section?: string;
  };
  // New fields for message association
  messageId?: string;
  userMessage?: string;
  aiResponse?: string;
  
  // Fields for consolidated citations
  originalRanks?: number[];
  citationCount?: number;
  displayText?: string;
  
  // Fields for processed citations  
  isPartOfGroup?: boolean;
  siblingRanks?: number[];
  groupSize?: number;
}

// Utility function to convert backend citation format to frontend format
export function convertBackendCitations(backendCitations: any[]): Citation[] {
  if (!Array.isArray(backendCitations)) {
    console.log("convertBackendCitations: backendCitations is not an array:", backendCitations);
    return [];
  }

  console.log("convertBackendCitations: Processing", backendCitations.length, "citations");
  console.log("convertBackendCitations: Sample citation:", backendCitations[0]);

  return backendCitations.map((citation, index) => {
    // Handle different backend citation formats
    if (typeof citation === 'string') {
      // Simple string citation
      return {
        rank: index + 1,
        document: `Document ${index + 1}`,
        relevance_score: 0.8,
        content: citation,
        metadata: {}
      };
    }

    if (typeof citation === 'object' && citation !== null) {
      console.log(`convertBackendCitations: Processing citation ${index + 1}:`, citation);
      console.log(`convertBackendCitations: Citation ${index + 1} metadata:`, citation.metadata);
      
      // Object citation with various possible field names
      const convertedCitation = {
        rank: citation.rank || citation.rank_number || index + 1,
        document: citation.document || citation.doc_name || citation.document_name || citation.title || citation.metadata?.document_name || citation.metadata?.page_title || `Document ${index + 1}`,
        relevance_score: citation.relevance_score || citation.score || citation.confidence || 0.8,
        content: citation.content || citation.text || citation.excerpt || citation.summary || '',
        metadata: {
          // Check both direct fields and nested metadata fields
          source_url: citation.metadata?.source_url || citation.source_url || citation.url || citation.link,
          file_path: citation.metadata?.file_path || citation.file_path || citation.path,
          doc_type: citation.metadata?.doc_type || citation.doc_type || citation.type || citation.format,
          notion_url: citation.metadata?.notion_url || citation.notion_url || citation.notion_link,
          download_url: citation.metadata?.download_url || citation.download_url || citation.download_link,
          page_title: citation.metadata?.page_title || citation.page_title || citation.title,
          section: citation.metadata?.section || citation.section || citation.chunk || citation.part
        }
      };
      
      console.log(`convertBackendCitations: Converted citation ${index + 1}:`, convertedCitation);
      return convertedCitation;
    }

    // Fallback for unknown format
    return {
      rank: index + 1,
      document: `Document ${index + 1}`,
      relevance_score: 0.8,
      content: String(citation),
      metadata: {}
    };
  });
}

// Demo function to test the artifact widget
export function createDemoCitations(): Citation[] {
  return [
    {
      rank: 1,
      document: "Yale Ventures Summer Fellowship Program",
      relevance_score: 0.95,
      content: "The Yale Ventures Summer Fellowship is a 10-week program that provides funding, mentorship, and resources to Yale students working on innovative ventures. Participants receive up to $15,000 in funding and access to Yale's innovation ecosystem.",
      metadata: {
        doc_type: "notion",
        notion_url: "https://yale-ventures.notion.site/summer-fellowship",
        page_title: "Summer Fellowship Program",
        section: "Program Overview"
      }
    },
    {
      rank: 2,
      document: "Yale Innovation Fund Guidelines",
      relevance_score: 0.87,
      content: "The Yale Innovation Fund provides seed funding for early-stage ventures founded by Yale students, faculty, and alumni. Funding ranges from $5,000 to $50,000 depending on the stage and needs of the venture.",
      metadata: {
        doc_type: "pdf",
        download_url: "https://yale-ventures.edu/innovation-fund-guidelines.pdf",
        page_title: "Innovation Fund Guidelines",
        section: "Funding Criteria"
      }
    },
    {
      rank: 3,
      document: "Yale Ventures Mentorship Network",
      relevance_score: 0.82,
      content: "Connect with experienced entrepreneurs, investors, and industry experts through Yale Ventures' mentorship network. Mentors provide guidance on business strategy, fundraising, and technical development.",
      metadata: {
        doc_type: "web",
        source_url: "https://yale-ventures.edu/mentorship",
        page_title: "Mentorship Network",
        section: "Available Mentors"
      }
    }
  ];
}

export interface ArtifactWidgetProps {
  citations: Citation[];
  title?: string;
  className?: string;
}

export const ArtifactWidget = ({ 
  citations, 
  title = "Referenced Documents", 
  className 
}: ArtifactWidgetProps) => {
  const [expanded, setExpanded] = useState(false); // Default to minimized (dropdown closed)
  const [selectedCitation, setSelectedCitation] = useState<number | null>(null);
  const [expandedContent, setExpandedContent] = useState<Set<number>>(new Set());

  // Process citations to group by unique sources but keep original numbering
  const processedCitations = React.useMemo(() => {
    if (!citations || citations.length === 0) return [];

    // Group citations by unique source - prioritize URL over document name for web content
    const sourceGroups: { [key: string]: Citation[] } = {};
    
    citations.forEach(citation => {
      // For web content, use the full URL as the primary identifier to ensure sub-pages stay separate
      const url = citation.metadata?.source_url || citation.metadata?.notion_url;
      const document = citation.document || 'Unknown';
      
      // Create a unique key that ensures different URLs are always separate
      const sourceKey = url ? url : `${document}|${citation.rank}`;
      
      if (!sourceGroups[sourceKey]) {
        sourceGroups[sourceKey] = [];
      }
      sourceGroups[sourceKey].push(citation);
    });

    // Convert to unique source entries, showing only one card per unique source
    const uniqueSources: Citation[] = [];
    
    Object.entries(sourceGroups).forEach(([, citationGroup]) => {
      const ranks = citationGroup.map(c => c.rank).sort((a, b) => a - b);
      
      // Use the first citation as the representative for this source
      const representativeCitation: Citation = {
        ...citationGroup[0], // Keep original citation data
        originalRanks: ranks,
        citationCount: citationGroup.length,
        isPartOfGroup: citationGroup.length > 1,
        groupSize: citationGroup.length,
        // Combine content from all citations in this group
        content: citationGroup.map(c => c.content).join('\n\n....\n\n'),
      };
      
      uniqueSources.push(representativeCitation);
    });

    // Sort by the first citation number from each source
    return uniqueSources.sort((a, b) => 
      (a.originalRanks?.[0] || a.rank) - (b.originalRanks?.[0] || b.rank)
    );
  }, [citations]);

  // Debug logging
  console.log("ArtifactWidget: Received citations:", citations);
  console.log("ArtifactWidget: Processed citations:", processedCitations);
  if (citations && citations.length > 0) {
    console.log("ArtifactWidget: First original citation:", citations[0]);
    console.log("ArtifactWidget: First processed citation:", processedCitations[0]);
  }

  if (!citations || citations.length === 0) {
    return (
      <div className={cn("w-full", className)}>
        <div className="text-center py-8">
          <div className="text-sm text-muted-foreground mb-2">No sources referenced yet</div>
          <Badge variant="outline" className="text-xs">Ready for sources</Badge>
        </div>
      </div>
    );
  }

  // Show all processed citations when expanded, none when collapsed
  const visibleCitations = expanded ? processedCitations : [];

  const getDocumentIcon = (docType?: string) => {
    switch (docType?.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'notion':
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case 'web':
        return <LinkIcon className="h-4 w-4 text-green-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };


  // Helper function to detect if a URL points to a file
  const isFileUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // Common file extensions
      const fileExtensions = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.txt', '.rtf', '.csv', '.json', '.xml', '.html', '.htm',
        '.md', '.markdown', '.tex', '.odt', '.ods', '.odp'
      ];
      
      // Check if the path ends with a file extension
      const hasFileExtension = fileExtensions.some(ext => pathname.endsWith(ext));
      
      // Check if the path contains file-like patterns
      const hasFilePattern = pathname.includes('/files/') || 
                            pathname.includes('/documents/') || 
                            pathname.includes('/uploads/') ||
                            pathname.includes('/assets/') ||
                            pathname.includes('/media/');
      
      // Check if it's a local file path (starts with file://)
      const isLocalFile = url.startsWith('file://');
      
      return hasFileExtension || hasFilePattern || isLocalFile;
    } catch (error) {
      // If URL parsing fails, assume it might be a file
      return true;
    }
  };

  const createSectionSpecificLink = (citation: Citation): string => {
    const { metadata, content, document } = citation;
    
    if (!metadata?.source_url) return '';
    
    try {
      const url = new URL(metadata.source_url);
      
      // Add section information if available
      if (metadata.section) {
        // Create a URL fragment for the section
        const sectionFragment = metadata.section
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        url.hash = sectionFragment;
      }
      
      // Add search terms for highlighting
      const searchTerms = extractSearchTerms(content, document);
      if (searchTerms) {
        url.searchParams.set('q', searchTerms);
        url.searchParams.set('highlight', 'true');
        url.searchParams.set('source', 'yale-ventures-chatbot');
      }
      
      // Add citation-specific identifier
      const citationId = `${document.replace(/[^a-z0-9]/gi, '-')}-${citation.rank}`;
      url.searchParams.set('citation_id', citationId);
      
      return url.toString();
    } catch (error) {
      console.warn('Failed to create enhanced URL:', error);
      return metadata.source_url; // Fallback to original URL
    }
  };

  const extractSearchTerms = (content: string, document: string): string => {
    // Extract key terms from content and document name
    const terms = [];
    
    // Add document name terms (first 3-4 words)
    const docWords = document.split(' ').slice(0, 4);
    terms.push(...docWords);
    
    // Add key content terms (first 100 chars, excluding common words)
    const contentWords = content
      .substring(0, 100)
      .split(' ')
      .filter(word => word.length > 3 && !isCommonWord(word))
      .slice(0, 3);
    terms.push(...contentWords);
    
    // Remove duplicates and join
    const uniqueTerms = [...new Set(terms)];
    return uniqueTerms.join(' ').trim();
  };

  const isCommonWord = (word: string): boolean => {
    const commonWords = [
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'
    ];
    return commonWords.includes(word.toLowerCase());
  };

  const CitationCard = ({ citation, index }: { citation: Citation; index: number }) => {
    const isSelected = selectedCitation === index;
    
    // Calculate if citation has actionable links (not file-based links that redirect to coming soon)
    const hasActionableLinks = (() => {
      if (citation.metadata?.notion_url) return true;

      if (citation.metadata?.source_url) {
        // Only count as actionable if it's a website, not a file
        return !isFileUrl(citation.metadata.source_url);
      }

      // Download URLs are not actionable yet (redirect to coming soon)
      return false;
    })();
    
    const isContentExpanded = expandedContent.has(index);

    return (
      <Card 
        className={cn(
          "citation-card transition-all duration-200 hover:shadow-md cursor-pointer",
          isSelected ? "ring-2 ring-blue-500 shadow-md" : "",
          className
        )}
        onClick={() => setSelectedCitation(isSelected ? null : index)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getDocumentIcon(citation.metadata?.doc_type)}
              <CardTitle className="text-sm font-medium truncate">
                {citation.document}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Badge variant="outline" className="text-xs">
                {citation.originalRanks && citation.originalRanks.length > 0 
                  ? `[${citation.originalRanks.join(', ')}]`
                  : `#${citation.rank}`
                }
              </Badge>
              {citation.citationCount && citation.citationCount > 1 && (
                <Badge 
                  variant="secondary" 
                  className="text-xs bg-blue-50 text-blue-700"
                  title={`${citation.citationCount} chunks from this source: [${citation.originalRanks?.join(', ')}]`}
                >
                  {citation.citationCount} chunks
                </Badge>
              )}
            </div>
          </div>
          
          {citation.metadata?.section && (
            <div className="text-xs text-muted-foreground">
              Section: {citation.metadata.section}
            </div>
          )}
        </CardHeader>

        {isSelected && (
          <CardContent className="pt-0">
            <div className="space-y-3">
              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                {citation.metadata?.notion_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(citation.metadata!.notion_url, '_blank');
                    }}
                    className="flex items-center gap-1"
                  >
                    <BookOpen className="h-3 w-3" />
                    View in Notion
                  </Button>
                )}
                
                
{citation.metadata?.source_url && !isFileUrl(citation.metadata.source_url) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      const enhancedUrl = createSectionSpecificLink(citation);
                      window.open(enhancedUrl, '_blank');
                    }}
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open Link
                  </Button>
                )}
                
                {citation.metadata?.download_url && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = '/citations-coming-soon';
                    }}
                    className="flex items-center gap-1 bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"
                  >
                    <Clock className="h-3 w-3" />
                    Document Store Coming Soon
                  </Button>
                )}
                
                {!hasActionableLinks && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = '/citations-coming-soon';
                    }}
                    className="flex items-center gap-1 bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"
                  >
                    <Clock className="h-3 w-3" />
                    Coming Soon
                  </Button>
                )}
              </div>
              
              {/* Additional Metadata */}
              {(citation.metadata?.page_title || citation.metadata?.section) && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  {citation.metadata?.page_title && (
                    <div>Page: {citation.metadata.page_title}</div>
                  )}
                  {citation.metadata?.section && (
                    <div>Section: {citation.metadata.section}</div>
                  )}
                </div>
              )}
              
              {/* Source Content - Only show in development */}
              {citation.content && process.env.NEXT_PUBLIC_SHOW_CITATION_SOURCE_CONTENT === 'true' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-green-50 rounded border border-green-200">
                    <div className="font-medium text-green-800 mb-2 flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Source Content:
                    </div>
                    <div className="text-green-700 leading-relaxed whitespace-pre-line">
                      {(() => {
                        let content = isContentExpanded || citation.content.length <= 500 
                          ? citation.content
                          : `${citation.content.substring(0, 500)}...`;
                        
                        // Clean up common RAG formatting issues
                        content = content
                          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
                          .replace(/\*(.*?)\*/g, '$1')     // Remove markdown italic
                          .replace(/\n{3,}/g, '\n\n')     // Reduce excessive line breaks
                          .trim();
                        
                        return content;
                      })()}
                    </div>
                    {citation.content.length > 500 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newExpanded = new Set(expandedContent);
                          if (isContentExpanded) {
                            newExpanded.delete(index);
                          } else {
                            newExpanded.add(index);
                          }
                          setExpandedContent(newExpanded);
                        }}
                        className="mt-2 text-green-600 text-xs font-medium hover:text-green-800 hover:underline transition-colors"
                      >
                        {isContentExpanded ? '▲ Show less' : '▼ Show full content'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className={cn("space-y-3 artifact-widget", className)}>
      <style jsx global>{`
        .citation-card.highlighted {
          background-color: #fef3c7 !important;
          border-color: #f59e0b !important;
          box-shadow: 0 0 0 2px #f59e0b40 !important;
          animation: highlightPulse 0.5s ease-out;
        }
        
        @keyframes highlightPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `}</style>
      {/* Header with integrated dropdown button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <h3 className="font-medium text-sm">{title}</h3>
          <Badge variant="secondary" className="text-xs">
            {processedCitations.length > 0 
              ? `${processedCitations.length} ${processedCitations.length === 1 ? 'source' : 'sources'}`
              : 'Ready for sources'
            }
          </Badge>
        </div>
        
        {processedCitations.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
      </div>

      {/* Citations Section */}
      <div className="space-y-2">
        {visibleCitations.length > 0 ? (
          visibleCitations.map((citation, index) => (
            <CitationCard key={index} citation={citation} index={index} />
          ))
        ) : processedCitations.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No sources referenced yet</p>
            <p className="text-xs">Citations will appear here when you ask questions that require knowledge base searches</p>
          </div>
        ) : null}
      </div>

      {/* Quick Access Bar */}
      <div className="flex gap-1 pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => {
            const actionableUrls = processedCitations
              .map(c => {
                if (c.metadata?.notion_url) return c.metadata.notion_url;
                if (c.metadata?.source_url && !isFileUrl(c.metadata.source_url)) return c.metadata.source_url;
                return null;
              })
              .filter(Boolean);
            
            actionableUrls.forEach(url => url && window.open(url, '_blank'));
          }}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Open All ({processedCitations.filter(c => {
            if (c.metadata?.notion_url) return true;
            if (c.metadata?.source_url && !isFileUrl(c.metadata.source_url)) return true;
            return false;
          }).length})
        </Button>
      </div>
    </div>
  );
};