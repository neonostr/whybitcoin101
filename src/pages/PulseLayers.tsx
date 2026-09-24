import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { SimplePool } from "nostr-tools/pool";
import { nip19 } from "nostr-tools";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Search, Copy, ExternalLink, Quote, Eye, EyeOff, Shield, Users, ArrowLeft, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NostrEvent {
  id: string;
  content: string;
  created_at: number;
  pubkey: string;
  tags: string[][];
  quotedEvents?: NostrEvent[];
}

interface UserProfile {
  name?: string;
  about?: string;
  picture?: string;
  display_name?: string;
}

const BaseLayers = () => {
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<NostrEvent[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [quotedEvents, setQuotedEvents] = useState<Record<string, NostrEvent>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAuthors, setShowAuthors] = useState(false);
  const [webOfTrustEnabled, setWebOfTrustEnabled] = useState(false);
  const [webOfTrustNpub, setWebOfTrustNpub] = useState("");
  const [webOfTrustLevel, setWebOfTrustLevel] = useState<1 | 2>(1);
  const [trustedPubkeys, setTrustedPubkeys] = useState<Set<string>>(new Set());
  const [webOfTrustLoading, setWebOfTrustLoading] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const poolRef = useRef<SimplePool | null>(null);

  const relays = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.nostr.band",
    "wss://relay.primal.net",
    "wss://nostr.wine"
  ];

  useEffect(() => {
    poolRef.current = new SimplePool();
    
    return () => {
      if (poolRef.current) {
        poolRef.current.close(relays);
        poolRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    fetchHashtagContent();
  }, []);

  useEffect(() => {
    filterEvents();
  }, [searchTerm, events, webOfTrustEnabled, trustedPubkeys]);

  const fetchHashtagContent = async () => {
    if (!poolRef.current) return;

    setLoading(true);
    
    try {
      const filter = {
        kinds: [1],
        "#t": ["whybitcoin101"],
        limit: 200
      };

      const fetchedEvents = await poolRef.current.querySync(relays, filter);
      
      // Remove duplicates by event ID
      const uniqueEvents = fetchedEvents.filter((event, index, self) => 
        index === self.findIndex(e => e.id === event.id)
      );
      
      // Sort by created_at descending (newest first)
      const sortedEvents = uniqueEvents.sort((a, b) => b.created_at - a.created_at);
      
      // Fetch user profiles
      const uniquePubkeys = [...new Set(sortedEvents.map(e => e.pubkey))];
      await fetchUserProfiles(uniquePubkeys);
      
      // For events that are just hashtags and are replies, try to get the original content
      const enrichedEvents = await enrichReplyEvents(sortedEvents);
      
      // Process quoted events
      const eventsWithQuotes = await processQuotedEvents(enrichedEvents);
      
      // Extract and fetch profiles for all mentioned users
      const mentionedPubkeys = new Set<string>();
      eventsWithQuotes.forEach(event => {
        const mentions = extractNostrReferences(event.content);
        mentions.forEach(mention => {
          if (mention.type === 'npub' || mention.type === 'nprofile') {
            mentionedPubkeys.add(mention.pubkey);
          }
        });
      });
      
      if (mentionedPubkeys.size > 0) {
        await fetchUserProfiles(Array.from(mentionedPubkeys));
      }
      
      // Final deduplication to ensure no duplicates exist
      const finalEvents = eventsWithQuotes.filter((event, index, self) => 
        index === self.findIndex(e => e.id === event.id)
      );
      
      setEvents(finalEvents);
    } catch (error) {
      console.error("Error fetching hashtag content:", error);
    } finally {
      setLoading(false);
    }
  };

  const enrichReplyEvents = async (events: NostrEvent[]): Promise<NostrEvent[]> => {
    if (!poolRef.current) return events;

    const enrichedEvents = [];
    
    for (const event of events) {
      const replyTags = event.tags.filter(tag => tag[0] === 'e');
      
      // Check if event is a reply and has minimal content (hashtag + max 7 additional chars)
      if (replyTags.length > 0) {
        const content = event.content.trim();
        const hasHashtag = content.includes('#whybitcoin101') || content.includes('#');
        
        if (hasHashtag) {
          // Remove all hashtags and count remaining characters
          const contentWithoutHashtags = content.replace(/#\w+/g, '').trim();
          const remainingChars = contentWithoutHashtags.replace(/\s+/g, '').length;
          
          if (remainingChars <= 7) {
            // Try to fetch the original event being replied to
            try {
              const originalEventId = replyTags[0][1];
              const originalEvents = await poolRef.current.querySync(relays, {
                kinds: [1],
                ids: [originalEventId],
                limit: 1
              });
              
              if (originalEvents.length > 0) {
                // Use original content but keep the reply metadata and ensure unique ID
                enrichedEvents.push({
                  ...event,
                  content: originalEvents[0].content,
                  originalEvent: originalEvents[0]
                });
                continue;
              }
            } catch (error) {
              console.error("Error fetching original event:", error);
            }
          }
        }
      }
      
      enrichedEvents.push(event);
    }
    
    // Remove any duplicates that might have been created during enrichment
    return enrichedEvents.filter((event, index, self) => 
      index === self.findIndex(e => e.id === event.id)
    );
  };

  const processQuotedEvents = async (events: NostrEvent[]): Promise<NostrEvent[]> => {
    if (!poolRef.current) return events;

    const eventsWithQuotes = [];
    const quotedEventIds = new Set<string>();
    let quotedEventsMap: Record<string, NostrEvent> = {};

    // For naddr address pointers
    type AddrKey = string;
    const addressPointerKeys = new Set<AddrKey>();
    const addressEventsMap: Record<AddrKey, NostrEvent> = {};

    // First pass: collect all quoted references (ids and address pointers)
    for (const event of events) {
      const quotes = extractNostrReferences(event.content);
      quotes.forEach((quote: any) => {
        if ((quote.type === 'nevent' || quote.type === 'note') && quote.eventId) {
          quotedEventIds.add(quote.eventId);
        } else if (quote.type === 'naddr') {
          const key: AddrKey = `${quote.kind}:${quote.pubkey}:${quote.identifier}`;
          addressPointerKeys.add(key);
        }
      });
    }

    // Fetch all quoted events in batch (nevent/note by ID)
    if (quotedEventIds.size > 0) {
      try {
        const quotedEventsData = await poolRef.current.querySync(relays, {
          kinds: [1],
          ids: Array.from(quotedEventIds),
          limit: quotedEventIds.size
        });

        quotedEventsData.forEach(event => {
          quotedEventsMap[event.id] = event;
        });
        setQuotedEvents(prev => ({ ...prev, ...quotedEventsMap }));

        // Fetch profiles for quoted event authors
        const quotedAuthors = quotedEventsData.map(e => e.pubkey);
        if (quotedAuthors.length > 0) {
          await fetchUserProfiles(quotedAuthors);
        }

        // Fetch profiles for mentions within quoted events
        const quotedMentionedPubkeys = new Set<string>();
        quotedEventsData.forEach(event => {
          const mentions = extractNostrReferences(event.content);
          mentions.forEach(mention => {
            if (mention.type === 'npub' || mention.type === 'nprofile') {
              quotedMentionedPubkeys.add(mention.pubkey);
            }
          });
        });
        
        if (quotedMentionedPubkeys.size > 0) {
          await fetchUserProfiles(Array.from(quotedMentionedPubkeys));
        }
      } catch (error) {
        console.error("Error fetching quoted events:", error);
      }
    }

    // Fetch all quoted events via address pointers (naddr)
    if (addressPointerKeys.size > 0) {
      try {
        const kindsSet = new Set<number>();
        const authorsSet = new Set<string>();
        const identifiersSet = new Set<string>();
        addressPointerKeys.forEach((k) => {
          const [knd, pub, ident] = k.split(':');
          kindsSet.add(parseInt(knd, 10));
          authorsSet.add(pub);
          identifiersSet.add(ident);
        });

        const addrEventsData = await poolRef.current.querySync(relays, {
          kinds: Array.from(kindsSet),
          authors: Array.from(authorsSet),
          "#d": Array.from(identifiersSet),
          limit: 1000,
        });

        addrEventsData.forEach((event) => {
          const dTag = event.tags.find((t) => t[0] === 'd')?.[1];
          if (dTag) {
            const key = `${event.kind}:${event.pubkey}:${dTag}`;
            addressEventsMap[key] = event;
          }
        });

        // Fetch profiles for address-quoted event authors
        const addrAuthors = addrEventsData.map((e) => e.pubkey);
        if (addrAuthors.length > 0) {
          await fetchUserProfiles(addrAuthors);
        }

        // Fetch profiles for mentions within these address events
        const addrMentioned = new Set<string>();
        addrEventsData.forEach((event) => {
          const mentions = extractNostrReferences(event.content);
          mentions.forEach((mention) => {
            if (mention.type === 'npub' || mention.type === 'nprofile') {
              addrMentioned.add(mention.pubkey);
            }
          });
        });
        if (addrMentioned.size > 0) {
          await fetchUserProfiles(Array.from(addrMentioned));
        }
      } catch (error) {
        console.error('Error fetching naddr quoted events:', error);
      }
    }

    // Second pass: attach quoted events (by id and naddr) to main events
    for (const event of events) {
      const quotes = extractNostrReferences(event.content);
      const eventQuotedEvents: NostrEvent[] = [];

      quotes.forEach((quote: any) => {
        if ((quote.type === 'nevent' || quote.type === 'note') && quote.eventId) {
          const ev = quotedEventsMap[quote.eventId];
          if (ev) eventQuotedEvents.push(ev);
        } else if (quote.type === 'naddr') {
          const key = `${quote.kind}:${quote.pubkey}:${quote.identifier}`;
          const ev = addressEventsMap[key];
          if (ev) eventQuotedEvents.push(ev);
        }
      });

      eventsWithQuotes.push({
        ...event,
        quotedEvents: eventQuotedEvents.length > 0 ? eventQuotedEvents : undefined,
      });
    }

    return eventsWithQuotes;
  };

  const extractNostrReferences = (content: string) => {
    // Support both with and without the `nostr:` prefix
    const referenceRegex = /(?:nostr:)?(nevent1[a-zA-Z0-9]+|note1[a-zA-Z0-9]+|npub1[a-zA-Z0-9]+|nprofile1[a-zA-Z0-9]+|naddr1[a-zA-Z0-9]+)/g;
    const references = [] as Array<
      | { type: 'nevent'; raw: string; eventId: string; relays?: string[] }
      | { type: 'note'; raw: string; eventId: string }
      | { type: 'npub'; raw: string; pubkey: string }
      | { type: 'nprofile'; raw: string; pubkey: string; relays?: string[] }
      | { type: 'naddr'; raw: string; kind: number; pubkey: string; identifier: string; relays?: string[] }
    >;
    let match: RegExpExecArray | null;

    while ((match = referenceRegex.exec(content)) !== null) {
      const reference = match[1];
      try {
        const decoded = nip19.decode(reference);
        
        if (decoded.type === 'nevent') {
          references.push({
            type: 'nevent' as const,
            raw: match[0],
            eventId: decoded.data.id,
            relays: decoded.data.relays
          });
        } else if (decoded.type === 'note') {
          references.push({
            type: 'note' as const,
            raw: match[0],
            eventId: decoded.data
          });
        } else if (decoded.type === 'npub') {
          references.push({
            type: 'npub' as const,
            raw: match[0],
            pubkey: decoded.data
          });
        } else if (decoded.type === 'nprofile') {
          references.push({
            type: 'nprofile' as const,
            raw: match[0],
            pubkey: (decoded.data as any).pubkey,
            relays: (decoded.data as any).relays
          });
        } else if (decoded.type === 'naddr') {
          const d = decoded.data as any;
          references.push({
            type: 'naddr' as const,
            raw: match[0],
            kind: d.kind,
            pubkey: d.pubkey,
            identifier: d.identifier,
            relays: d.relays,
          });
        }
      } catch (error) {
        console.warn('Failed to decode nostr reference:', reference);
      }
    }

    return references;
  };

  const fetchUserProfiles = async (pubkeys: string[]) => {
    if (!poolRef.current) return;

    try {
      const profileFilter = {
        kinds: [0],
        authors: pubkeys,
        limit: pubkeys.length * 5 // Get multiple profile events per author
      };

      const profileEvents = await poolRef.current.querySync(relays, profileFilter);
      const profiles: Record<string, UserProfile> = {};

      // Sort by created_at to get the most recent profile for each pubkey
      const sortedEvents = profileEvents.sort((a, b) => b.created_at - a.created_at);
      
      sortedEvents.forEach(event => {
        // Only use the most recent profile for each pubkey
        if (!profiles[event.pubkey]) {
          try {
            const profileData = JSON.parse(event.content);
            profiles[event.pubkey] = profileData;
          } catch (error) {
            console.error("Error parsing profile:", error);
          }
        }
      });

      setUserProfiles(prev => ({ ...prev, ...profiles }));
    } catch (error) {
      console.error("Error fetching user profiles:", error);
    }
  };

  const filterEvents = () => {
    let filtered = events;

    // Hide specific testing notes by their npubs (more precise than text matching)
    // These were created during testing phase and shouldn't have used the hashtag
    const hiddenTestingNpubs = [
      nip19.decode("npub1z9aue008g635r6c549pyuaxr6y0wueq68364erusprj44nuanrvql558d3").data as string,nip19.decode("npub1384a86kplad450s7kzz2gen6pyfk3f7f3fme4zkyuf2mnyzdufwswlae8j").data as string, // Testing account that created spam notes
    ];

    // Filter out testing notes by npub
    filtered = filtered.filter(event => !hiddenTestingNpubs.includes(event.pubkey));

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(event => {
        // Search in main event content
        const mainContentMatch = event.content.toLowerCase().includes(searchLower);
        
        // Search in quoted events content
        const quotedContentMatch = event.quotedEvents?.some(quotedEvent => 
          quotedEvent.content.toLowerCase().includes(searchLower)
        ) || false;
        
        return mainContentMatch || quotedContentMatch;
      });
    }

    // Apply Web of Trust filter
    if (webOfTrustEnabled && trustedPubkeys.size > 0) {
      filtered = filtered.filter(event => trustedPubkeys.has(event.pubkey));
    }

    setFilteredEvents(filtered);
  };

  const extractMediaUrls = (content: string): string[] => {
    const urls: string[] = [];
    
    // Extract image URLs
    const imageRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      urls.push(match[1]);
    }
    
    // Extract video URLs
    const videoRegex = /(https?:\/\/[^\s]+\.(?:mp4|webm|mov))/gi;
    while ((match = videoRegex.exec(content)) !== null) {
      urls.push(match[1]);
    }
    
    // Extract YouTube URLs
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/gi;
    while ((match = youtubeRegex.exec(content)) !== null) {
      urls.push(`https://www.youtube.com/watch?v=${match[1]}`);
    }
    
    // Extract YouTube Trimmer URLs  
    const youtubeTrimmerRegex = /(https?:\/\/www\.youtubetrimmer\.com\/view\/\?v=[a-zA-Z0-9_-]+&start=\d+&end=\d+(?:&loop=\d+)?)/gi;
    while ((match = youtubeTrimmerRegex.exec(content)) !== null) {
      urls.push(match[1]);
    }
    
    return urls;
  };

  const copyVisibleContent = () => {
    const content = filteredEvents.map(event => {
      const cleanContent = removeNostrReferences(removeHashtags(event.content));
      const { textContent } = renderMedia(cleanContent);
      const mediaUrls = extractMediaUrls(event.content);
      
      let fullContent = '';
      
      if (showAuthors) {
        const author = getUserDisplayName(event.pubkey);
        const date = new Date(event.created_at * 1000).toLocaleDateString();
        fullContent = `[${date}] ${author}: ${textContent}`;
      } else {
        fullContent = textContent;
      }
      
      // Add media URLs if they exist
      if (mediaUrls.length > 0) {
        fullContent += '\n\nMedia:\n' + mediaUrls.join('\n');
      }
      
      // Add quoted events content if they exist
      if (event.quotedEvents && event.quotedEvents.length > 0) {
        event.quotedEvents.forEach(quotedEvent => {
          const quotedCleanContent = removeNostrReferences(removeHashtags(quotedEvent.content));
          const { textContent: quotedTextContent } = renderMedia(quotedCleanContent);
          const quotedMediaUrls = extractMediaUrls(quotedEvent.content);
          
          if (quotedTextContent.trim() || quotedMediaUrls.length > 0) {
            if (showAuthors) {
              const quotedAuthor = getUserDisplayName(quotedEvent.pubkey);
              const quotedDate = new Date(quotedEvent.created_at * 1000).toLocaleDateString();
              fullContent += `\n\n> Quoted from [${quotedDate}] ${quotedAuthor}: ${quotedTextContent}`;
            } else {
              fullContent += `\n\n> ${quotedTextContent}`;
            }
            if (quotedMediaUrls.length > 0) {
              fullContent += '\n> Media:\n> ' + quotedMediaUrls.join('\n> ');
            }
          }
        });
      }
      
      return fullContent;
    }).filter(content => {
      // Only include posts that have actual content
      const hasContent = showAuthors ? 
        content.split(': ')[1]?.trim().length > 0 : 
        content.trim().length > 0;
      return hasContent;
    }).join('\n\n');

    navigator.clipboard.writeText(content);
    toast({
      title: "Content copied!",
      description: `Copied ${filteredEvents.filter(event => {
        const cleanContent = removeNostrReferences(removeHashtags(event.content));
        const { textContent } = renderMedia(cleanContent);
        const mediaUrls = extractMediaUrls(event.content);
        return textContent.trim().length > 0 || mediaUrls.length > 0 || (event.quotedEvents && event.quotedEvents.some(q => {
          const qCleanContent = removeNostrReferences(removeHashtags(q.content));
          const { textContent: qTextContent } = renderMedia(qCleanContent);
          const qMediaUrls = extractMediaUrls(q.content);
          return qTextContent.trim().length > 0 || qMediaUrls.length > 0;
        }));
      }).length} notes to clipboard`,
    });
  };

  const buildWebOfTrust = async () => {
    if (!webOfTrustNpub.trim() || !poolRef.current) return;

    setWebOfTrustLoading(true);
    try {
      let trustPubkey: string;
      
      // Decode npub if provided
      try {
        const decoded = nip19.decode(webOfTrustNpub.trim());
        if (decoded.type === 'npub') {
          trustPubkey = decoded.data;
        } else {
          throw new Error('Invalid npub format');
        }
      } catch (error) {
        toast({
          title: "Invalid npub",
          description: "Please enter a valid npub",
          variant: "destructive"
        });
        return;
      }

      // Fetch the follow list (kind 3) for the trust root
      const followListEvents = await poolRef.current.querySync(relays, {
        kinds: [3],
        authors: [trustPubkey],
        limit: 1
      });

      if (followListEvents.length === 0) {
        toast({
          title: "No follow list found",
          description: "Could not find follow list for this npub",
          variant: "destructive"
        });
        return;
      }

      const followList = followListEvents[0];
      const directFollows = followList.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);

      let trustedSet = new Set([trustPubkey, ...directFollows]);

      // If level 2, also fetch follows of follows
      if (webOfTrustLevel === 2 && directFollows.length > 0) {
        const secondLevelEvents = await poolRef.current.querySync(relays, {
          kinds: [3],
          authors: directFollows,
          limit: directFollows.length
        });

        secondLevelEvents.forEach(event => {
          const secondLevelFollows = event.tags
            .filter(tag => tag[0] === 'p')
            .map(tag => tag[1]);
          secondLevelFollows.forEach(pubkey => trustedSet.add(pubkey));
        });
      }

      setTrustedPubkeys(trustedSet);
      toast({
        title: "Web of Trust built",
        description: `Trusting ${trustedSet.size} pubkeys (Level ${webOfTrustLevel})`,
      });
    } catch (error) {
      console.error("Error building Web of Trust:", error);
      toast({
        title: "Error",
        description: "Failed to build Web of Trust",
        variant: "destructive"
      });
    } finally {
      setWebOfTrustLoading(false);
    }
  };

  const getUserDisplayName = (pubkey: string): string => {
    const profile = userProfiles[pubkey];
    return profile?.name || profile?.display_name || `${pubkey.slice(0, 8)}...`;
  };

  const getDisplayNameForMention = (pubkey: string): string => {
    const profile = userProfiles[pubkey];
    // Always return a display name - prefer profile name, fallback to shortened pubkey
    return profile?.name || profile?.display_name || `${pubkey.slice(0, 8)}...`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const removeHashtags = (content: string): string => {
    return content.replace(/#whybitcoin101/gi, '').trim();
  };

  const removeNostrReferences = (content: string): string => {
    let processedContent = content;
    
    // Helper function to process npub/nprofile mentions
    const processNostrMention = (mentionString: string): string => {
      try {
        const decoded = nip19.decode(mentionString);
        if (decoded.type === 'npub') {
          const displayName = getDisplayNameForMention(decoded.data);
          return `@${displayName}`;
        } else if (decoded.type === 'nprofile') {
          const displayName = getDisplayNameForMention((decoded.data as any).pubkey);
          return `@${displayName}`;
        }
      } catch (error) {
        console.warn('Failed to decode nostr mention:', mentionString);
      }
      return mentionString;
    };
    
    // Handle ALL npub/nprofile mentions (both with and without nostr: prefix) in one pass
    const allMentionsRegex = /(?:nostr:)?(npub1[a-zA-Z0-9]+|nprofile1[a-zA-Z0-9]+)/g;
    
    processedContent = processedContent.replace(allMentionsRegex, (match, mention) => {
      const processed = processNostrMention(mention);
      return processed.startsWith('@') ? processed : match;
    });
    
    // Then remove note, nevent, and naddr references
    processedContent = processedContent.replace(/(?:nostr:)?(nevent1[a-zA-Z0-9]+|note1[a-zA-Z0-9]+|naddr1[a-zA-Z0-9]+)/g, '');
    
    return processedContent.trim();
  };

  const renderQuotedEvent = (quotedEvent: NostrEvent, isStandaloneQuote: boolean = false) => {
    const profile = userProfiles[quotedEvent.pubkey];
    const cleanQuotedContent = removeNostrReferences(removeHashtags(quotedEvent.content));
    const { textContent, mediaElements } = renderMedia(cleanQuotedContent);
    
    // If it's a standalone quote (just note ID + hashtag), don't apply quote styling
    if (isStandaloneQuote) {
      return (
        <div className="mt-3">
          {showAuthors && (
            <div className="flex items-center gap-2 mb-2">
              <img
                src={profile?.picture || `https://robohash.org/${quotedEvent.pubkey}?set=set4&size=21x21`}
                alt={`Profile photo of ${getUserDisplayName(quotedEvent.pubkey)}`}
                className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary"
                onClick={() => openNostrProfile(quotedEvent.pubkey)}
              />
              <span 
                className="font-medium cursor-pointer hover:text-primary truncate"
                onClick={() => openNostrProfile(quotedEvent.pubkey)}
              >
                {getUserDisplayName(quotedEvent.pubkey)}
              </span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDate(quotedEvent.created_at)}
              </span>
            </div>
          )}
          
          {textContent && (
            <div className="prose prose-sm max-w-none mb-2">
              <p className="whitespace-pre-wrap text-foreground break-words">
                {textContent}
              </p>
            </div>
          )}
          
          {mediaElements.length > 0 && (
            <div className="space-y-2">
              {mediaElements}
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="border-l-4 border-primary/30 pl-4 mt-3 bg-muted/30 rounded-r-lg p-3">
        {showAuthors && (
          <div className="flex items-center gap-2 mb-2">
            <Quote className="h-4 w-4 text-primary flex-shrink-0" />
            <img
              src={profile?.picture || `https://robohash.org/${quotedEvent.pubkey}?set=set4&size=21x21`}
              alt={`Profile photo of ${getUserDisplayName(quotedEvent.pubkey)}, quoted author`}
              className="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary"
              onClick={() => openNostrProfile(quotedEvent.pubkey)}
            />
            <span 
              className="font-medium cursor-pointer hover:text-primary truncate"
              onClick={() => openNostrProfile(quotedEvent.pubkey)}
            >
              {getUserDisplayName(quotedEvent.pubkey)}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatDate(quotedEvent.created_at)}
            </span>
          </div>
        )}
        
        {textContent && (
          <div className="prose prose-sm max-w-none mb-2">
            <p className="whitespace-pre-wrap text-foreground break-words">
              {textContent}
            </p>
          </div>
        )}
        
        {mediaElements.length > 0 && (
          <div className="space-y-2">
            {mediaElements}
          </div>
        )}
      </div>
    );
  };

  const cleanUrlFromTrackers = (url: string): string => {
    try {
      const urlObj = new URL(url);
      // Remove all query parameters to strip tracking
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch (error) {
      // If URL parsing fails, return original
      return url;
    }
  };

  const renderMedia = (content: string) => {
    // Image URLs
    const imageRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
    const videoRegex = /(https?:\/\/[^\s]+\.(?:mp4|webm|mov|avi|mkv|m4v))/gi;
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/gi;
    const youtubeTrimmerRegex = /https?:\/\/www\.youtubetrimmer\.com\/view\/\?v=([a-zA-Z0-9_-]+)&start=(\d+)&end=(\d+)(?:&loop=\d+)?/gi;
    // Generic URL regex to catch other URLs that might leave spacing
    const genericUrlRegex = /(https?:\/\/[^\s]+)/gi;

    let processedContent = content;
    const mediaElements = [];

    // Extract and render images
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      mediaElements.push(
        <img 
          key={match[1]} 
          src={match[1]} 
          alt="Image shared in a #whybitcoin101 note on Nostr" 
          className="w-full h-auto object-contain rounded-lg mt-2 max-h-96"
          loading="lazy"
        />
      );
      processedContent = processedContent.replace(match[1], '');
    }

    // Extract and render videos
    while ((match = videoRegex.exec(content)) !== null) {
      const videoUrl = match[1];
      mediaElements.push(
        <video 
          key={videoUrl} 
          src={videoUrl} 
          controls 
          preload="metadata"
          className="w-full max-w-full max-h-96 rounded-lg mt-2"
          onError={(e) => {
            // Show a link instead if the video fails to load
            const target = e.target as HTMLVideoElement;
            const linkElement = document.createElement('a');
            linkElement.href = videoUrl;
            linkElement.textContent = `Video: ${videoUrl}`;
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
            linkElement.className = 'text-primary hover:underline';
            target.parentNode?.replaceChild(linkElement, target);
          }}
        >
          Your browser does not support the video tag.
          <a href={match[1]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Download video: {match[1]}
          </a>
        </video>
      );
      processedContent = processedContent.replace(match[1], '');
    }

    // Extract and render YouTube Trimmer videos
    while ((match = youtubeTrimmerRegex.exec(content)) !== null) {
      const videoId = match[1];
      const startTime = match[2];
      const endTime = match[3];
      mediaElements.push(
        <div key={`trimmer-${videoId}-${startTime}`} className="mt-2 w-full">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              src={`https://www.youtube.com/embed/${videoId}?start=${startTime}&end=${endTime}`}
              title="YouTube video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );
      processedContent = processedContent.replace(match[0], '');
    }

    // Extract and render YouTube videos
    while ((match = youtubeRegex.exec(content)) !== null) {
      const videoId = match[1];
      mediaElements.push(
        <div key={videoId} className="mt-2 w-full">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );
      processedContent = processedContent.replace(match[0], '');
    }

    // Convert remaining URLs to clickable links
    const remainingUrls = [];
    while ((match = genericUrlRegex.exec(processedContent)) !== null) {
      // Check if this URL wasn't already processed as media
      const url = match[1];
      const isAlreadyProcessed = content !== processedContent || 
        imageRegex.test(url) || videoRegex.test(url) || 
        youtubeRegex.test(url) || youtubeTrimmerRegex.test(url);
      
      if (!isAlreadyProcessed) {
        remainingUrls.push(url);
        const cleanedUrl = cleanUrlFromTrackers(url);
        // Replace URL with a clickable link element
        mediaElements.push(
          <a 
            key={url} 
            href={cleanedUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-foreground hover:underline break-all inline-flex items-center gap-1"
          >
            {cleanedUrl}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
        );
        processedContent = processedContent.replace(url, '');
      }
    }

    // Clean up whitespace and formatting
    processedContent = processedContent
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Replace multiple line breaks with double line break
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      // Remove leading/trailing whitespace from each line
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .trim();

    return {
      textContent: processedContent,
      mediaElements
    };
  };

  const openNostrProfile = (pubkey: string) => {
    const url = `https://primal.net/p/${pubkey}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Pulse Layer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link 
                to="/get-involved" 
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Get Involved</span>
              </Link>
            </div>
            
            <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="About the Live Pulse" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                 <div className="space-y-4 text-sm">
                  <div>
                    <h2 className="font-medium mb-2">The Pulse</h2>
                    <p className="text-muted-foreground">
                      The Pulse is a living, real time hive mind around Bitcoin. Every note tagged with <strong>#whybitcoin101</strong> that shows why Bitcoin matters or offers broader insight into Bitcoin flows here through the decentralized Nostr network.
                      Together, they form a collective stream of Bitcoin culture, knowledge, and education.
                    </p>
                  </div>
                  <div>
                    <h2 className="font-medium mb-2">How It Can Be Used</h2>
                    <p className="text-muted-foreground">
                      The Pulse is more than a feed - it's our inspiration layer. Browse through it to discover new angles, remix sparks, or paste parts (or even the whole stream) into AI
                      and explore what new creations emerge. Each piece adds to a shared pool of imagination with endless possibilities.
                    </p>
                  </div>
                  <div>
                    <h2 className="font-medium mb-2">How To Contribute</h2>
                    <p className="text-muted-foreground">
                    Post from any Nostr client (like Primal, Damus, or Amethyst), include the hashtag <strong>#whybitcoin101</strong>, and your spark becomes part of the Pulse. Each spark is fuel - it might inspire someone, somewhere, to explain why Bitcoin matters in a clearer way, sharpening our collective orange pill. That's how we wake up the world to Bitcoin's importance.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-2xl font-bold">Live Pulse</h1>
            <Badge variant="secondary">#whybitcoin101</Badge>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* Main Controls Row */}
            <div className="flex flex-col gap-4">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search bitcoin knowledge..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <Button 
                  onClick={() => setShowAuthors(!showAuthors)} 
                  variant="outline" 
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  {showAuthors ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  <span className="sm:inline">
                    {showAuthors ? "Hide Authors" : "Show Authors"}
                  </span>
                </Button>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant={webOfTrustEnabled ? "default" : "outline"} 
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      <span className="sm:inline">Web of Trust Filter</span>
                      {webOfTrustEnabled && trustedPubkeys.size > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {trustedPubkeys.size}
                        </Badge>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Web of Trust Filter
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Enable Filter</span>
                        <Button
                          onClick={() => setWebOfTrustEnabled(!webOfTrustEnabled)}
                          variant={webOfTrustEnabled ? "default" : "outline"}
                          size="sm"
                        >
                          {webOfTrustEnabled ? "Enabled" : "Disabled"}
                        </Button>
                      </div>
                      
                      {webOfTrustEnabled && (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Trust Root (npub)</label>
                            <Input
                              placeholder="Enter npub (e.g., npub123...)"
                              value={webOfTrustNpub}
                              onChange={(e) => setWebOfTrustNpub(e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Trust Level</label>
                            <Select value={webOfTrustLevel.toString()} onValueChange={(value) => setWebOfTrustLevel(parseInt(value) as 1 | 2)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">
                                  <div className="flex items-center gap-2">
                                    <Users className="h-3 w-3" />
                                    Level 1 (Direct follows)
                                  </div>
                                </SelectItem>
                                <SelectItem value="2">
                                  <div className="flex items-center gap-2">
                                    <Users className="h-3 w-3" />
                                    Level 2 (Extended network)
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <Button
                            onClick={buildWebOfTrust}
                            disabled={!webOfTrustNpub.trim() || webOfTrustLoading}
                            className="w-full"
                          >
                            {webOfTrustLoading ? "Building Trust Network..." : "Build Web of Trust"}
                          </Button>
                          
                          {trustedPubkeys.size > 0 && (
                            <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
                              ✓ Filtering by {trustedPubkeys.size} trusted pubkeys (Level {webOfTrustLevel})
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button onClick={copyVisibleContent} variant="outline" size="sm" className="w-full sm:w-auto">
                  <Copy className="h-4 w-4 mr-2" />
                  <span className="sm:inline">Copy Visible ({filteredEvents.length})</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {filteredEvents.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 
                `No notes found containing "${searchTerm}"` : 
                "No content found"
              }
            </p>
            <p className="text-sm text-muted-foreground">
              Have some great Bitcoin insights? Share them on{" "}
              <a 
                href="https://nostr.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Nostr
              </a>{" "}
              with hashtag #whybitcoin101
            </p>
          </div>
        )}

        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {filteredEvents.map((event, index) => {
            const profile = userProfiles[event.pubkey];
            const cleanContent = removeNostrReferences(removeHashtags(event.content));
            const { textContent, mediaElements } = renderMedia(cleanContent);
            
            // Check if this is a standalone quote (note ID + hashtag only)
            const isStandaloneQuote = event.quotedEvents && event.quotedEvents.length > 0 && 
              (() => {
                const originalContent = event.content.trim();
                // Remove hashtags and whitespace
                const contentWithoutHashtags = originalContent.replace(/#\w+/g, '').trim();
                // Check if remaining content is just nostr references
                const nostrRefs = extractNostrReferences(originalContent);
                const contentWithoutNostrRefs = removeNostrReferences(contentWithoutHashtags);
                // It's standalone if there's minimal content after removing hashtags and nostr refs
                return contentWithoutNostrRefs.length <= 5 && nostrRefs.length > 0;
              })();
            
            return (
              <Card key={`${event.id}-${searchTerm}`} className="hover:shadow-md transition-shadow h-fit break-inside-avoid mb-4">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {showAuthors && !isStandaloneQuote && (
                      <img
                        src={profile?.picture || `https://robohash.org/${event.pubkey}?set=set4&size=21x21`}
                        alt={`Profile photo of ${getUserDisplayName(event.pubkey)}`}
                        className="w-10 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-primary flex-shrink-0"
                        onClick={() => openNostrProfile(event.pubkey)}
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      {showAuthors && !isStandaloneQuote && (
                        <div className="flex items-center gap-2 mb-2">
                          <span 
                            className="font-medium cursor-pointer hover:text-primary truncate"
                            onClick={() => openNostrProfile(event.pubkey)}
                          >
                            {getUserDisplayName(event.pubkey)}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDate(event.created_at)}
                          </span>
                        </div>
                      )}
                      
                      {textContent && !isStandaloneQuote && (
                        <div className="prose prose-sm max-w-none mb-2">
                          <p className="whitespace-pre-wrap text-foreground break-words">
                            {textContent}
                          </p>
                        </div>
                      )}
                      
                      {mediaElements.length > 0 && !isStandaloneQuote && (
                        <div className="space-y-2">
                          {mediaElements}
                        </div>
                      )}

                      {/* Render quoted events */}
                      {event.quotedEvents && event.quotedEvents.map((quotedEvent, qIndex) => (
                        <div key={`${event.id}-quote-${qIndex}-${searchTerm}`}>
                          {renderQuotedEvent(quotedEvent, isStandaloneQuote)}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BaseLayers;
