import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import VideoModal from "./VideoModal";
import CopyButton from "./CopyButton";
import ResourceCopyButton from "./ResourceCopyButton";
const Resources = () => {
  const [videoModal, setVideoModal] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
  }>({
    isOpen: false,
    title: "",
    url: ""
  });

  const resourcesText = `Dive Deeper

Ready to learn more? These carefully curated resources will guide you towards a deeper understanding.`;

  // Video resources
  const videos = [{
    title: "Bitcoin vs Crypto - Know the Difference",
    description: "Discover why Bitcoin stands alone. Learn its revolutionary origin story, the problems it uniquely solves, and why it's fundamentally different from all other cryptocurrencies.",
    type: "Essential",
    url: "https://www.youtube.com/watch?v=p0ftZgCEZos"
  }, {
    title: "The Broken Money System Exposed",
    description: "Eye-opening exploration of how our current monetary system creates inequality, enables endless money printing, and why society desperately needs a better alternative.",
    type: "Eye-Opening",
    url: "https://www.youtube.com/watch?v=Pef22g53zsg"
  }, {
    title: "Bitcoin Timing - Early or Late?",
    description: "Worried you missed the boat? This perspective-shifting analysis reveals why we're still in Bitcoin's early adoption phase and what that means for you.",
    type: "Perspective",
    url: "https://www.youtubetrimmer.com/view/?v=5893JBg7r9k&start=773&end=1003&loop=0"
  }, {
    title: "Bitcoin vs Diversification Myth",
    description: "Challenge conventional investment wisdom. Learn why concentrating in Bitcoin might be the smartest diversification strategy for the digital age.",
    type: "Strategy",
    url: "https://www.youtube.com/watch?v=kunaljk_Psc"
  }, {
    title: "Federal Reserve - The Greatest Lie",
    description: "Shocking truth about America's central bank: it's neither federal nor has reserves. Understand the private institution that controls your money's value.",
    type: "Truth Bomb",
    url: "https://v.nostr.build/tIA2DN77tAW2qNgT.mp4"
  }, {
    title: "Inflation - The Silent Wealth Thief",
    description: "Analysis of how inflation destroys the social fabric by eroding savings, widening inequality, and breaking the fundamental promise that hard work leads to prosperity.",
    type: "Wake-Up Call",
    url: "https://www.youtubetrimmer.com/view/?v=qfeMas1zU6Q&start=2327&end=2514&loop=0"
  }];

  // Articles & Essays
  const articles = [{
    title: "21 Lessons",
    author: "Gigi",
    description: "A transformative journey down the Bitcoin rabbit hole. Follow Gigi's profound realizations about money, time, and human nature through 21 life-changing lessons that will reshape how you see the world.",
    type: "Essay",
    url: "https://21lessons.com"
  }, {
    title: "Deep Dive Bitcoin & Society",
    author: "Gigi",
    description: "Essential collection of thought-provoking essays exploring Bitcoin's profound impact on society, philosophy, and human freedom. Deep insights that connect Bitcoin to the fabric of civilization itself.",
    type: "Blog",
    url: "http://dergigi.com"
  }, {
    title: "Bitcoin, Freedom and Sovereignty",
    author: "Aleksandar Svetski",
    description: "Compelling argument that Bitcoin adoption isn't just financially smart - it's a moral imperative. Discover why choosing Bitcoin is choosing freedom, sovereignty, and a better future for humanity.",
    type: "Article",
    url: "https://svetski.medium.com/fiat-fascism-and-communism-d185e66733b"
  }];

  // Books
  const books = [{
    title: "The Fiat Standard",
    author: "Saifedean Ammous",
    description: "Devastating exposé of how fiat money enslaves humanity through endless inflation, perpetual debt, and centralized control. Discover the dark mechanics behind government currencies and why they're designed to transfer wealth from savers to spenders.",
    type: "Essential Reading",
    url: "https://saifedean.com/tfs"
  }, {
    title: "The Bitcoin Standard",
    author: "Saifedean Ammous",
    description: "The definitive guide to understanding Bitcoin as the hardest money ever created. Trace the evolution of money from shells to gold to Bitcoin, and discover why sound money is the foundation of human prosperity and freedom.",
    type: "Essential Reading",
    url: "https://saifedean.com/tbs"
  }, {
    title: "Broken Money",
    author: "Lyn Alden",
    description: "Masterful analysis of how technological innovation drives monetary evolution throughout history. Understand why our current financial system is fundamentally broken and how Bitcoin represents the inevitable next step in money's technological evolution.",
    type: "Essential Reading",
    url: "https://thesaifhouse.com/bmsample"
  }];

  // Podcasts
  const podcasts = [
      {
    title: "Bitcoin Audible",
    host: "Guy Swann",
    description: "Essential Bitcoin education through curated readings and expert analysis. Guy Swann transforms complex Bitcoin content into digestible audio format, making deep Bitcoin knowledge accessible to everyone.",
    type: "Educational Deep Dives",
    url: "https://bitcoinaudible.com/"
      },
    {
    title: "What Bitcoin Did",
    host: "Danny Knowles",
    description: "Cutting-edge conversations with Bitcoin's most influential voices. Danny Knowles conducts in-depth interviews with developers, economists, and thought leaders shaping Bitcoin's future.",
    type: "Expert Interviews",
    url: "https://www.whatbitcoindid.com/episodes"
  },
  {
    title: "The Jack Mallers Show",
    host: "Jack Mallers",
    description: "Bitcoin and macro analysis. Jack Mallers delivers passionate breakdowns of Bitcoin's role in global economics, monetary policy impacts, and the inevitable transition to a Bitcoin standard.",
    type: "Weekly Macro Updates",
    url: "https://creators.spotify.com/pod/profile/thejackmallersshow/"
  }
                                      
];

  // Mobile Wallets
  const mobileWallets = [{
    title: "Muun - Lightning Made Simple",
    description: "The perfect first Bitcoin wallet. Seamlessly handles both on-chain and Lightning transactions with automatic fee optimization and bulletproof security - no technical knowledge required.",
    type: "Beginner Friendly",
    url: "https://muun.com/"
  }, {
    title: "Blue Wallet - Power User's Choice",
    description: "Advanced Bitcoin and Lightning wallet with exceptional UX. Features watch-only wallets, multisig support, and Tor integration for privacy-conscious users who want full control.",
    type: "Advanced Features",
    url: "https://bluewallet.io"
  }, {
    title: "Nunchuk - Enterprise Security",
    description: "Professional-grade Bitcoin wallet with multisig, inheritance planning, and collaborative custody. Perfect for Bitcoin holders who need advanced security and estate planning features.",
    type: "Multisig & Inheritance",
    url: "https://nunchuk.io"
  }];

  // Hardware Wallets
  const hardwareWallets = [{
    title: "Tangem - The Simplest Way To Start",
    description: "Self-custody in three minutes. A Swiss-made, EAL6+ certified chip card that you simply tap to your phone - no cables, no batteries, no backups to write down. The backup cards are your recovery, making it the easiest first step into holding your own keys.",
    type: "Beginner Friendly",
    url: "https://tangem.com"
  }, {
    title: "Foundation Passport - Elegant Security",
    description: "Beautiful hardware security meets Bitcoin-only focus. Open-source design with camera-based airgapped transactions and an intuitive interface that makes self-custody accessible to everyone.",
    type: "Premium Design",
    url: "https://foundation.xyz"
  }, {
    title: "Bitkey - Complete Security System",
    description: "More than just a hardware wallet - it's a complete Bitcoin security ecosystem. Includes mobile app, hardware device, and recovery services to protect against losing your phone, hardware, or both.",
    type: "Full System",
    url: "https://bitkey.world"
  }];

  // Exchanges
  const exchanges = [{
    title: "River",
    description: "Bitcoin specialist with automatic DCA, zero-fee ACH transfers, and direct wallet deposits. Clean interface focused purely on Bitcoin.",
    type: "USA",
    url: "https://river.com/buy-bitcoin"
  }, {
    title: "Bittr",
    description: "European Bitcoin exchange that sends directly to your wallet. Low fees, fast processing, and streamlined Bitcoin purchasing.",
    type: "CH/EU",
    url: "https://getbittr.com/"
  }, {
    title: "Bitcoin Well",
    description: "Canadian Bitcoin exchange with Lightning Network support and instant wallet delivery. Simple buying process with competitive rates.",
    type: "CANADA",
    url: "https://bitcoinwell.com/buy-bitcoin"
  }, 
  {
    title: "Coincorner",
    description: "UK's leading Bitcoin exchange with Lightning Network integration and DCA options. FCA-registered with instant SEPA transfers and direct wallet delivery.",
    type: "UK",
    url: "https://www.coincorner.com"
  },
    {
    title: "Bitaroo",
    description: "Australia's premium Bitcoin exchange with competitive spreads and instant OSKO payments and direct wallet withdrawals.",
    type: "Australia",
    url: "https://www.bitaroo.com.au"
  },
                                       
  {
    title: "HodlHodl",
    description: "Global peer-to-peer Bitcoin marketplace. Trade directly with other users using multisig escrow without identity verification requirements.",
    type: "Worldwide",
    url: "https://hodlhodl.com"
  }];

  // Living On Bitcoin
  const livingOnBitcoin = [{
    title: "BTC Map",
    description: "Discover the growing Bitcoin economy around you. Interactive global map revealing thousands of Bitcoin-accepting businesses from coffee shops to car dealerships - proving Bitcoin is already money.",
    type: "Map",
    url: "https://btcmap.org/"
  }, 
  {
    title: "Bitcoin Listings Directory",
    description: "Your gateway to the Bitcoin economy. Comprehensive database of online shops and local businesses ready to accept your Bitcoin - from everyday essentials to luxury goods.",
    type: "Directory",
    url: "https://bitcoinlistings.org/"
  },
  {
    title: "Lightning Network Stores",
    description: "Experience instant Bitcoin payments in action. Curated collection of stores, apps, and services accepting Lightning payments - showcasing the future of fast, cheap Bitcoin transactions.",
    type: "Directory",
    url: "https://lightningnetworkstores.com/"
  },                           
  {
    title: "Bitrefill",
    description: "Turn your Bitcoin into everything you need. Revolutionary platform for buying gift cards, mobile top-ups, eSIMs, and gaming credits with Bitcoin - bridging crypto to everyday purchases.",
    type: "Gift Cards",
    url: "https://www.bitrefill.com"
  },
    {
    title: "Opportunity Cost",
    description: "See the true cost of fiat spending. Genius browser extension that displays prices in Bitcoin, helping you understand opportunity costs and naturally develop a Bitcoin mindset for every purchase.",
    type: "Tool",
    url: "https://www.opportunitycost.app"
  },
  {
    title: "Travala",
    description: "Explore the world on a Bitcoin standard. Book over 3 million hotels, flights, tours, and activities worldwide using Bitcoin - proving you can live entirely on sound money while traveling anywhere.",
    type: "Travel",
    url: "https://www.travala.com"
  }
      ];

  // Educational Entertainment
  const educationalEntertainment = [{
    title: "Isa 21 Days - Surviving on Bitcoin",
    description: "Watch Isabella survive 3 weeks on a remote island with nothing but Bitcoin. Every meal, ride, and job must be paid with BTC she earns herself. An incredible real-world test of Bitcoin's utility.",
    type: "Documentary Series",
    url: "https://www.youtube.com/watch?v=OE98XhB1uM4&list=PLpoMYLIrh9fO8xnIXBsRPk6H83G5rI5W6"
  }, {
    title: "The Exit Manual - Unmasking The System",
    description: "Discover how the modern financial system really works - and why it doesn't. Exit Manual breaks down big ideas like inflation, money printing, and Bitcoin in clear, concise videos that show the path to financial independence.",
    type: "Educational Series",
    url: "https://www.youtube.com/@exitmanual"
  }, {
    title: "Joey Nakamoto - Bitcoin Adventures",
    description: "Entertaining and educational Bitcoin content that makes learning about sound money fun and engaging. Perfect blend of entertainment and Bitcoin education.",
    type: "YouTube Channel", 
    url: "https://www.youtube.com/@JoeNakamoto"
  }];

  // Fun Stuff
  const funStuff = [{
    title: "Feed Real Cats with Lightning",
    description: "Experience the magic of instant micropayments by feeding cats in real-time using Bitcoin's Lightning Network. Watch them enjoy their treats as your sats arrive instantly!",
    type: "Interactive",
    url: "https://lightningcats.io/"
  }, {
    title: "Lightning-Powered Goat Farm",
    description: "Send Bitcoin Lightning payments to feed an adorable herd of goats in real-time. Watch live streams, interact on Nostr, and see the future of peer-to-peer value transfer in action.",
    type: "Live Stream",
    url: "https://lightning-goats.com/"
  }, {
    title: "Sheep Feeding via Sats",
    description: "Join the live Twitch stream and use Lightning micropayments to feed friendly sheep. A delightful demonstration of how Bitcoin enables instant, borderless transactions for any purpose.",
    type: "Twitch Stream",
    url: "https://www.twitch.tv/tanglesheep"
  }];
  const handleVideoClick = (title: string, url: string) => {
    setVideoModal({
      isOpen: true,
      title,
      url
    });
  };
  const handleLinkClick = (url: string) => {
    window.open(url, '_blank');
  };
  const renderSection = (title: string, emoji: string, items: any[], isVideo = false, categoryName = "") => <div className="mb-16">
      <h3 className="text-3xl font-bold text-center mb-10 text-foreground">{emoji} {title}</h3>
      <div className="grid md:grid-cols-3 gap-6">
        {items.map((item, index) => {
          const hashtag = `#whybitcoin101resource${categoryName}${index + 1}`;
          return (
            <Card key={index} className="group hover:shadow-[var(--card-hover)] transition-all duration-300 cursor-pointer relative" onClick={() => isVideo ? handleVideoClick(item.title, item.url) : handleLinkClick(item.url)}>
              <ResourceCopyButton 
                title={item.title}
                description={item.description}
                type={item.type}
                url={item.url}
                author={item.author}
                host={item.host}
                hashtag={hashtag}
              />
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors duration-300">
                    {item.title}
                  </CardTitle>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {item.type}
                  </span>
                </div>
                {item.author && <p className="text-sm text-muted-foreground">by {item.author}</p>}
                {item.host && <p className="text-sm text-muted-foreground">Hosted by {item.host}</p>}
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>;
  return <>
      <section id="resources" className="py-20 px-4 bg-background">
        <div className="container mx-auto relative">
          <CopyButton text={resourcesText} hashtag="#whybitcoin101resources" />
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Dive Deeper
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Ready to learn more? These carefully curated resources will guide you towards a deeper understanding.</p>
          </div>

          {renderSection("Videos", "🎥", videos, true, "videos")}
          {renderSection("Articles & Essays", "📄", articles, false, "articles")}
          {renderSection("Books", "📚", books, false, "books")}
          {renderSection("Podcasts", "🎧", podcasts, false, "podcasts")}
          {renderSection("Mobile Wallets", "📱", mobileWallets, false, "mobile-wallets")}
          {renderSection("Hardware Wallets", "🔒", hardwareWallets, false, "hardware-wallets")}
          {renderSection("Exchanges", "💱", exchanges, false, "exchanges")}
          {renderSection("Living On Bitcoin", "🌍", livingOnBitcoin, false, "living-on-bitcoin")}
          {renderSection("Educational Entertainment", "🍿", educationalEntertainment, false, "educational-entertainment")}
          {renderSection("Fun Stuff", "🎉", funStuff, false, "fun-stuff")}

          <div className="text-center">
            <div className="inline-block p-8 rounded-2xl bg-gradient-to-r from-primary/5 to-bitcoin-orange/5 border border-primary/10">
              <h3 className="text-2xl font-bold mb-4 text-foreground">Start Your Journey</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Take your time exploring these resources. Bitcoin is a marathon, not a sprint.
              </p>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => document.getElementById('faq')?.scrollIntoView({
              behavior: 'smooth'
            })}>
                Common Questions
              </Button>
            </div>
          </div>
        </div>
      </section>

      <VideoModal isOpen={videoModal.isOpen} onClose={() => setVideoModal({
      isOpen: false,
      title: "",
      url: ""
    })} title={videoModal.title} videoUrl={videoModal.url} />
    </>;
};
export default Resources;