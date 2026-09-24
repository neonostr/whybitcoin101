import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SimplePool } from "nostr-tools/pool";
import { nip19 } from "nostr-tools";
import { getPublicKey, finalizeEvent } from "nostr-tools/pure";
import { ArrowLeft, MessageCircle, Calendar, User, Send, Heart, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NostrEvent {
  id: string;
  content: string;
  created_at: number;
  pubkey: string;
  tags: string[][];
}

interface UserProfile {
  name?: string;
  about?: string;
  picture?: string;
}

const QuestionFollow = () => {
  const { key } = useParams<{ key: string }>();
  const [originalQuestion, setOriginalQuestion] = useState<NostrEvent | null>(null);
  const [replies, setReplies] = useState<NostrEvent[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [likingPost, setLikingPost] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  
  // Single pool instance for the entire component
  const poolRef = useRef<SimplePool | null>(null);
  const lastRefreshRef = useRef<number>(0);

  // Better, more reliable relays
  const relays = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.nostr.band",
    "wss://relay.primal.net",
    "wss://nostr.wine"
  ];

  // Phrases to filter out from replies
  const hiddenPhrases = ["https://rizful.com"];

  // Initialize pool once
  useEffect(() => {
    poolRef.current = new SimplePool();
    
    // Cleanup on unmount
    return () => {
      if (poolRef.current) {
        poolRef.current.close(relays);
        poolRef.current = null;
      }
    };
  }, []);

  // Recursive function to fetch all nested replies
  const fetchAllReplies = async (pool: any, eventIds: string[], allReplies: NostrEvent[] = [], maxDepth = 10, currentDepth = 0): Promise<NostrEvent[]> => {
    if (currentDepth >= maxDepth || eventIds.length === 0) {
      return allReplies;
    }

    console.log(`Fetching replies at depth ${currentDepth} for ${eventIds.length} events`);

    const replyFilter = {
      kinds: [1],
      "#e": eventIds,
      limit: 500
    };

    const newReplies = await pool.querySync(relays, replyFilter);
    
    // Filter out duplicates and add to our collection
    const uniqueNewReplies = newReplies.filter(newReply => 
      !allReplies.find(existing => existing.id === newReply.id)
    );
    
    const updatedReplies = [...allReplies, ...uniqueNewReplies];
    
    console.log(`Found ${uniqueNewReplies.length} new replies at depth ${currentDepth}`);
    
    // If we found new replies, recursively search for replies to those
    if (uniqueNewReplies.length > 0) {
      const newEventIds = uniqueNewReplies.map(r => r.id);
      return await fetchAllReplies(pool, newEventIds, updatedReplies, maxDepth, currentDepth + 1);
    }
    
    return updatedReplies;
  };

  const fetchQuestionAndReplies = async () => {
    if (!key || !poolRef.current) {
      setError("Invalid follow-up link");
      setLoading(false);
      return;
    }

    try {
      // Determine if we have nsec (private key) or npub (public key)
      let publicKey: string;
      let hasPrivateKey = false;
      
      if (key.startsWith('nsec')) {
        // Decode nsec private key to get the public key
        const { data: privateKey } = nip19.decode(key);
        publicKey = getPublicKey(privateKey as Uint8Array);
        hasPrivateKey = true;
      } else if (key.startsWith('npub')) {
        // Decode npub directly to get the public key
        const { data: decodedPubkey } = nip19.decode(key);
        publicKey = decodedPubkey as string;
        hasPrivateKey = false;
      } else {
        setError("Invalid key format. Must be nsec or npub.");
        setLoading(false);
        return;
      }

      const pool = poolRef.current;
      
      // Find the original question by this pubkey with whybitcoin101faq tag
      const questionFilter = {
        kinds: [1],
        authors: [publicKey],
        "#t": ["whybitcoin101", "whybitcoin101faq"],
        limit: 1
      };
      
      console.debug("Searching for question with filter:", questionFilter);

      const questionEvents = await pool.querySync(relays, questionFilter);
      
      console.debug("Found question events:", questionEvents.length);
      
      if (questionEvents.length > 0) {
        const question = questionEvents[0];
        setOriginalQuestion(question);

        // Recursively fetch ALL replies at any depth
        console.log("Starting recursive reply fetch...");
        const allReplies = await fetchAllReplies(pool, [question.id]);

        // Get likes for all events (question + all replies)
        const allEventIds = [question.id, ...allReplies.map(r => r.id)];
        const likeFilter = {
          kinds: [7],
          "#e": allEventIds,
          limit: 1000
        };

        const likeEvents = await pool.querySync(relays, likeFilter);
        
        // Count likes per event
        const likeCounts: Record<string, number> = {};
        likeEvents.forEach(like => {
          const eventId = like.tags.find(tag => tag[0] === 'e')?.[1];
          if (eventId) {
            likeCounts[eventId] = (likeCounts[eventId] || 0) + 1;
          }
        });
        setLikes(likeCounts);

        // Filter out replies containing hidden phrases and sort by timestamp
        const filteredReplies = allReplies
          .filter(reply => {
            return !hiddenPhrases.some(phrase => reply.content.includes(phrase));
          })
          .sort((a, b) => a.created_at - b.created_at); // Sort oldest first
        
        console.log("Total replies found (all depths):", allReplies.length);
        console.log("Filtered replies:", filteredReplies.length);
        console.log("Like counts:", likeCounts);
        
        setReplies(filteredReplies);

        // Fetch user profiles for all unique pubkeys
        const allPubkeys = [publicKey, ...allReplies.map(r => r.pubkey)];
        const uniquePubkeys = [...new Set(allPubkeys)];
        
        const profileFilter = {
          kinds: [0],
          authors: uniquePubkeys,
        };

        const profileEvents = await pool.querySync(relays, profileFilter);
        
        // Process profiles
        const profiles: Record<string, UserProfile> = {};
        profileEvents.forEach(event => {
          try {
            const profile = JSON.parse(event.content);
            profiles[event.pubkey] = profile;
          } catch (e) {
            console.warn("Failed to parse profile:", e);
          }
        });
        
        setUserProfiles(profiles);
      } else {
        setError("Question not found or not yet propagated to relays");
      }

    } catch (err) {
      console.error("Error fetching question:", err);
      setError("Failed to load question and replies");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuestionAndReplies();
  }, [key]);

  const handleRefresh = async () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshRef.current;
    
    // Rate limit: only allow refresh every 60 seconds
    if (timeSinceLastRefresh < 60000) {
      return; // Silently ignore if too soon
    }
    
    lastRefreshRef.current = now;
    setRefreshing(true);
    
    toast({
      title: "Refreshing...",
      description: "Checking for new replies and updates.",
    });
    
    await fetchQuestionAndReplies();
    
    toast({
      title: "Refreshed!",
      description: "Content has been updated.",
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const truncateKey = (key: string) => {
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  const getUserDisplayName = (pubkey: string) => {
    const profile = userProfiles[pubkey];
    return profile?.name || truncateKey(pubkey);
  };

  // Helper function to extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const renderMedia = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex) || [];
    
    return urls.map((url, index) => {
      // YouTube videos
      const youtubeId = getYouTubeVideoId(url);
      if (youtubeId) {
        return (
          <div key={index} className="mt-2">
            <iframe
              width="100%"
              height="315"
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title="YouTube video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg max-w-full"
            />
          </div>
        );
      }
      
      // Enhanced GIF detection - check for .gif extension OR gif in URL OR common GIF hosting patterns
      if (url.match(/\.gif(\?|$)/i) || 
          url.includes('gif') || 
          url.includes('giphy.com') || 
          url.includes('tenor.com') ||
          url.includes('imgur.com/') && url.includes('gif')) {
        return (
          <img 
            key={index}
            src={url} 
            alt="Animated GIF shared in a reply to this Bitcoin question" 
            className="max-w-full h-auto rounded-lg mt-2 max-h-96 object-contain"
            loading="lazy"
          />
        );
      }
      // Regular images
      if (url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)) {
        return (
          <img 
            key={index}
            src={url} 
            alt="Image shared in a reply to this Bitcoin question" 
            className="max-w-full h-auto rounded-lg mt-2 max-h-96 object-contain"
            loading="lazy"
          />
        );
      }
      // Videos
      if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
        return (
          <video 
            key={index}
            src={url} 
            controls 
            className="max-w-full h-auto rounded-lg mt-2 max-h-96"
          />
        );
      }
      return null;
    });
  };

  // Helper function to resolve mentions from p tags
  const resolveMentions = (content: string, event: NostrEvent) => {
    const pTags = event.tags.filter(tag => tag[0] === 'p');
    let processedContent = content;
    
    // Replace nostr:npub mentions with @username
    const nostrMentionRegex = /nostr:(npub1[a-z0-9]{58})/g;
    processedContent = processedContent.replace(nostrMentionRegex, (match, npub) => {
      try {
        const { data: pubkey } = nip19.decode(npub);
        const username = getUserDisplayName(pubkey as unknown as string);
        return `@${username}`;
      } catch (e) {
        return match; // Keep original if decode fails
      }
    });
    
    // Replace #[index] mentions with @username
    const indexMentionRegex = /#\[(\d+)\]/g;
    processedContent = processedContent.replace(indexMentionRegex, (match, indexStr) => {
      const index = parseInt(indexStr);
      if (index < pTags.length) {
        const pubkey = pTags[index][1];
        const username = getUserDisplayName(pubkey);
        return `@${username}`;
      }
      return match; // Keep original if index is out of bounds
    });
    
    return processedContent;
  };

  const formatContent = (content: string, event: NostrEvent) => {
    // First resolve mentions
    let processedContent = resolveMentions(content, event);
    
    // Remove URLs that will be rendered as media
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    processedContent = processedContent.replace(urlRegex, (url) => {
      // Enhanced media URL detection including YouTube
      if (url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg)(\?|$)/i) ||
          url.includes('gif') || 
          url.includes('giphy.com') || 
          url.includes('tenor.com') ||
          getYouTubeVideoId(url)) {
        return '';
      }
      return url;
    }).trim();
    
    return processedContent;
  };

  // Helper function to get what this reply is replying to and calculate nesting depth
  const getReplyContext = (reply: NostrEvent) => {
    const eTags = reply.tags.filter(tag => tag[0] === 'e');
    if (eTags.length === 0) return { type: 'question', target: originalQuestion, depth: 0 };
    
    // Find if this is replying to the original question or another reply
    const replyToId = eTags[eTags.length - 1][1]; // Last e tag is usually the direct reply target
    
    if (replyToId === originalQuestion?.id) {
      return { type: 'question', target: originalQuestion, depth: 0 };
    }
    
    const parentReply = replies.find(r => r.id === replyToId);
    if (parentReply) {
      const parentContext = getReplyContext(parentReply);
      return { type: 'reply', target: parentReply, depth: parentContext.depth + 1 };
    }
    
    return { type: 'question', target: originalQuestion, depth: 0 };
  };

  const handleReply = async (replyToEventId: string) => {
    if (!key || !replyText.trim() || !poolRef.current) return;
    
    // Only allow replies if we have a private key (nsec)
    if (!key.startsWith('nsec')) {
      toast({
        title: "Cannot reply",
        description: "Replying requires your private key (nsec). This link only has your public key (npub).",
        variant: "destructive",
      });
      return;
    }

    setSubmittingReply(true);
    try {
      const { data: privateKey } = nip19.decode(key);
      const publicKey = getPublicKey(privateKey as Uint8Array);

      const replyEvent = finalizeEvent({
        kind: 1,
        content: replyText.trim(),
        tags: [
          ["e", replyToEventId, "", "reply"],
          ["p", originalQuestion?.pubkey || ""]
        ],
        created_at: Math.floor(Date.now() / 1000),
      }, privateKey as Uint8Array);

      // Use the existing pool
      try {
        await poolRef.current.publish(relays, replyEvent);
      } catch (e) {
        console.log("Publish error:", e);
      }

      // Add reply to local state immediately
      const newReply = {
        id: replyEvent.id,
        content: replyEvent.content,
        created_at: replyEvent.created_at,
        pubkey: replyEvent.pubkey,
        tags: replyEvent.tags
      };
      setReplies(prev => [...prev, newReply].sort((a, b) => a.created_at - b.created_at));

      // Add user profile if not present
      if (!userProfiles[publicKey]) {
        setUserProfiles(prev => ({
          ...prev,
          [publicKey]: { name: "You" }
        }));
      }

      toast({
        title: "Reply posted!",
        description: "Your reply has been published to the network.",
      });

      setReplyText("");
      setReplyingTo(null);

    } catch (error) {
      console.error("Reply error:", error);
      toast({
        title: "Failed to post reply",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleLike = async (eventId: string) => {
    if (!key || !poolRef.current) return;
    
    // Only allow likes if we have a private key (nsec)
    if (!key.startsWith('nsec')) {
      toast({
        title: "Cannot like",
        description: "Liking requires your private key (nsec). This link only has your public key (npub).",
        variant: "destructive",
      });
      return;
    }

    setLikingPost(eventId);
    try {
      const { data: privateKey } = nip19.decode(key);
      const targetReply = replies.find(r => r.id === eventId) || originalQuestion;

      const likeEvent = finalizeEvent({
        kind: 7,
        content: "❤️",
        tags: [
          ["e", eventId],
          ["p", targetReply?.pubkey || ""]
        ],
        created_at: Math.floor(Date.now() / 1000),
      }, privateKey as Uint8Array);

      // Use the existing pool
      try {
        await poolRef.current.publish(relays, likeEvent);
      } catch (e) {
        console.log("Publish error:", e);
      }

      // Optimistically update like count
      setLikes(prev => ({
        ...prev,
        [eventId]: (prev[eventId] || 0) + 1
      }));

      toast({
        title: "Liked!",
        description: "Your reaction has been published.",
      });

    } catch (error) {
      console.error("Like error:", error);
      toast({
        title: "Failed to like post",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLikingPost(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your question...</p>
        </div>
      </div>
    );
  }

  if (error || !originalQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Question Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || "We couldn't find your question. It may still be propagating across the network or the link may be invalid."}
          </p>
          <Link to="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 relative">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          {/* Refresh Button */}
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="absolute top-0 right-0 bg-orange-500 hover:bg-orange-600 text-white"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <h1 className="text-3xl font-bold text-foreground">Your Bitcoin Question</h1>
          <p className="text-muted-foreground mt-2">
            Track responses to your question
          </p>
        </div>

        {/* Original Question */}
        <Card className="mb-8 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">Your Question</h2>
              <Badge variant="secondary">Original Post</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {formatContent(originalQuestion.content.replace(/\n\n#bitcoinbasics #bitcoinknowledgehub$/, ""), originalQuestion)}
              </p>
              {renderMedia(originalQuestion.content)}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(originalQuestion.created_at)}
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {getUserDisplayName(originalQuestion.pubkey)}
              </div>
              {likes[originalQuestion.id] && (
                <div className="flex items-center gap-1">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span>{likes[originalQuestion.id]}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Replies Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">
              Replies ({replies.length})
            </h2>
          </div>

          {replies.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No replies yet</h3>
                  <p className="text-muted-foreground">
                    Your question is live. Check back later for responses from the community.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            replies.map((reply) => {
              const replyContext = getReplyContext(reply);
              const indentLevel = Math.min(replyContext.depth, 5); // Cap at 5 levels to prevent excessive indentation
              
              return (
                <Card 
                  key={reply.id} 
                  className={`${indentLevel > 0 ? `border-l-4 border-l-muted-foreground/30` : ''}`}
                  style={indentLevel > 0 ? { marginLeft: `${indentLevel * 2}rem` } : {}}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {getUserDisplayName(reply.pubkey)}
                        </span>
                        {replyContext?.type === 'reply' && (
                          <span className="text-xs text-muted-foreground">
                            replying to {getUserDisplayName(replyContext.target.pubkey)}
                          </span>
                        )}
                        {indentLevel > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Level {indentLevel + 1}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(reply.created_at)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                        {formatContent(reply.content, reply)}
                      </p>
                      {renderMedia(reply.content)}
                    </div>
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => setReplyingTo(replyingTo === reply.id ? null : reply.id)}
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Reply
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-red-500"
                        onClick={() => handleLike(reply.id)}
                        disabled={likingPost === reply.id}
                      >
                        <Heart className={`h-4 w-4 mr-1 ${likingPost === reply.id ? 'animate-pulse' : ''}`} />
                        {likingPost === reply.id ? 'Liking...' : 'Like'}
                        {likes[reply.id] && <span className="ml-1">({likes[reply.id]})</span>}
                      </Button>
                    </div>
                    
                    {/* Reply Input */}
                    {replyingTo === reply.id && (
                      <div className="mt-4 space-y-3 border-t border-border pt-4">
                        <Textarea
                          placeholder="Write your reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="min-h-[100px]"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReply(reply.id)}
                            disabled={!replyText.trim() || submittingReply}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            {submittingReply ? 'Posting...' : 'Post Reply'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Refresh Note */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg border">
          <p className="text-sm text-muted-foreground text-center">
            💡 Responses can be almost instant or take a few days, depending on who's online. 
            Use the refresh button above to check for new replies.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuestionFollow;