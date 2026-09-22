import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

const VideoPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const video = getVideoBySlug(slug);
  const [isOpen, setIsOpen] = useState(Boolean(video));

  useEffect(() => {
    if (video) {
      window.scrollTo(0, 0);
      setIsOpen(true);
    } else {
      navigate("/", { replace: true });
    }
  }, [video, navigate]);

  const handleCloseVideo = () => {
    setIsOpen(false);
    navigate("/");
  };

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
          isOpen={isOpen && Boolean(video)}
          onClose={handleCloseVideo}
          title={video?.title ?? ""}
          videoUrl={video?.url ?? ""}
        />
      </div>
    </EditModeProvider>
  );
};

export default VideoPage;
