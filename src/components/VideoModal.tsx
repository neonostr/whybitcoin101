import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, ExternalLink, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  videoUrl: string;
}

const VideoModal = ({ isOpen, onClose, title, videoUrl }: VideoModalProps) => {
  const { toast } = useToast();

  const isNsite =
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".nsite.run");

  // Convert YouTube URLs to embed format with autoplay and timestamp
  const getEmbedUrl = (url: string) => {
    let embedUrl = "";
    let timestamp = "";
    
    // Extract timestamp if present
    if (url.includes("t=")) {
      const timeMatch = url.match(/[?&]t=(\d+)/);
      if (timeMatch) {
        timestamp = `&start=${timeMatch[1]}`;
      }
    }
    
    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1${timestamp}`;
    } else if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1${timestamp}`;
    } else {
      embedUrl = url; // Return as-is for other embed URLs
    }
    
    return embedUrl;
  };

  const createSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleShare = async () => {
    const slug = createSlug(title);
    
    // Store video data in localStorage with slug as key
    localStorage.setItem(`video-${slug}`, JSON.stringify({
      title,
      videoUrl,
      timestamp: Date.now()
    }));
    
    const shareUrl = `${window.location.origin}/video/${slug}`;
    
    // Check if native sharing is available (mobile)
    if (navigator.share && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: title,
          text: `Check out this video: ${title}\n\n${shareUrl}`,
          url: shareUrl,
        });
      } catch (error) {
        // Fallback to clipboard if user cancels or sharing fails
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link copied!",
          description: "Share link has been copied to clipboard",
        });
      }
    } else {
      // Desktop: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to clipboard",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full [&>button]:hidden">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <DialogTitle className="text-left">{title}</DialogTitle>
          <Button
            onClick={handleShare}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="aspect-video w-full">
          {isNsite ? (
            <div className="w-full h-full rounded-lg border border-border bg-muted/30 flex flex-col items-center justify-center text-center p-6 gap-4">
              <ShieldCheck className="h-10 w-10 text-primary" />
              <div className="space-y-2 max-w-md">
                <h3 className="text-base font-semibold">Watch this video securely</h3>
                <p className="text-sm text-muted-foreground">
                  You're browsing this site through the decentralized nsite.run gateway,
                  which keeps things censorship-resistant by blocking third-party embeds
                  like YouTube. Open the video in a new tab to watch it safely at the source.
                </p>
                <p className="text-xs text-muted-foreground">
                  Prefer inline playback? Visit{" "}
                  <a
                    href="https://whybitcoin101.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    whybitcoin101.com
                  </a>
                  .
                </p>
              </div>
              <Button asChild className="gap-2">
                <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open video
                </a>
              </Button>
            </div>
          ) : (
            <iframe
              src={getEmbedUrl(videoUrl)}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoModal;