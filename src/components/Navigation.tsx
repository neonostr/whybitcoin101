import { Button } from "@/components/ui/button";
import { useEditMode } from "@/contexts/EditModeContext";
import { useEffect, useRef } from "react";
import InfoModal from "./InfoModal";

const Navigation = () => {
  const { isEditMode, setIsEditMode, clickCount, setClickCount, setShowInfoModal, showInfoModal } = useEditMode();
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth'
    });
  };

  const handleConnectClick = () => {
    // If modal is open, don't do anything to prevent accidental closure
    if (showInfoModal) {
      return;
    }

    if (isEditMode) {
      scrollToSection('contact');
      return;
    }

    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // Clear existing timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    // Check if we've reached 5 clicks
    if (newClickCount >= 5) {
      setIsEditMode(true);
      setShowInfoModal(true);
      setClickCount(0);
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      return; // Prevent further processing once edit mode is activated
    }

    // Set new timeout to reset clicks after 5 seconds (only if not activating edit mode)
    clickTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
    }, 5000);

    scrollToSection('contact');
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setClickCount(0);
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <nav className="fixed top-0 w-full bg-background/95 backdrop-blur-sm border-b border-border z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="font-bold text-2xl text-primary">₿ Bitcoin Basics</div>
            
            <div className="hidden md:flex items-center space-x-6">
              <button onClick={() => scrollToSection('money-problem')} className="text-foreground hover:text-primary transition-colors duration-200">
                Why Bitcoin
              </button>
              <button onClick={() => scrollToSection('resources')} className="text-foreground hover:text-primary transition-colors duration-200">
                Resources
              </button>
              <button onClick={() => scrollToSection('faq')} className="text-foreground hover:text-primary transition-colors duration-200">
                FAQ
              </button>
              {isEditMode && (
                <Button onClick={exitEditMode} variant="destructive" size="sm">
                  Exit Edit Mode
                </Button>
              )}
              <Button onClick={handleConnectClick} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                Connect
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <InfoModal />
    </>
  );
};
export default Navigation;