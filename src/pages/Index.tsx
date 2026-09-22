import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import MoneyProblem from "@/components/MoneyProblem";
import Basics from "@/components/Basics";
import WhyBitcoin from "@/components/WhyBitcoin";
import Resources from "@/components/Resources";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import VideoModal from "@/components/VideoModal";
import { EditModeProvider } from "@/contexts/EditModeContext";
import { getVideoBySlug } from "@/data/videos";

const Index = () => {
  const [sharedVideo, setSharedVideo] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
  }>({
    isOpen: false,
    title: "",
    url: ""
  });

  useEffect(() => {
    // Shared video slug passed in the URL by the static /video/<slug> pages
    const slugParam = new URLSearchParams(window.location.search).get('v');
    const slugVideo = getVideoBySlug(slugParam ?? undefined);

    if (slugVideo) {
      window.scrollTo(0, 0);
      setSharedVideo({
        isOpen: true,
        title: slugVideo.title,
        url: slugVideo.url
      });
      return;
    }

    // Check for shared video flag from static HTML redirects (legacy)
    const sharedVideoData = localStorage.getItem('open-shared-video');
    
    if (sharedVideoData) {
      try {
        const parsed = JSON.parse(sharedVideoData);
        
        // Clear the flag
        localStorage.removeItem('open-shared-video');
        
        // Scroll to top
        window.scrollTo(0, 0);
        
        // Open video modal with shared content
        setSharedVideo({
          isOpen: true,
          title: parsed.title,
          url: parsed.videoUrl
        });
      } catch (error) {
        console.error('Error parsing shared video data:', error);
      }
    }
    
    // Check for shared video parameters in URL (legacy format for backwards compatibility)
    const urlParams = new URLSearchParams(window.location.search);
    const videoUrl = urlParams.get('video');
    const videoTitle = urlParams.get('title');
    
    if (videoUrl && videoTitle) {
      // Scroll to top
      window.scrollTo(0, 0);
      
      // Open video modal with shared content
      setSharedVideo({
        isOpen: true,
        title: decodeURIComponent(videoTitle),
        url: decodeURIComponent(videoUrl)
      });
      
      // Clean URL without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <EditModeProvider>
      <div className="min-h-screen bg-background">
        <Navigation />
        <Hero />
        <MoneyProblem />
        <Basics />
        <WhyBitcoin />
        <Resources />
        <FAQ />
        <Contact />
        
        <VideoModal 
          isOpen={sharedVideo.isOpen} 
          onClose={() => setSharedVideo({ isOpen: false, title: "", url: "" })} 
          title={sharedVideo.title} 
          videoUrl={sharedVideo.url} 
        />
      </div>
    </EditModeProvider>
  );
};

export default Index;
