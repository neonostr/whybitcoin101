export interface VideoResource {
  slug: string;
  title: string;
  description: string;
  type: string;
  url: string;
}

/** Same rule VideoModal uses when building a share link. */
export const createVideoSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

const rawVideos: Omit<VideoResource, "slug">[] = [
  {
    title: "Bitcoin vs Crypto - Know the Difference",
    description:
      "Discover why Bitcoin stands alone. Learn its revolutionary origin story, the problems it uniquely solves, and why it's fundamentally different from all other cryptocurrencies.",
    type: "Essential",
    url: "https://www.youtube.com/watch?v=p0ftZgCEZos",
  },
  {
    title: "The Broken Money System Exposed",
    description:
      "Eye-opening exploration of how our current monetary system creates inequality, enables endless money printing, and why society desperately needs a better alternative.",
    type: "Eye-Opening",
    url: "https://www.youtube.com/watch?v=Pef22g53zsg",
  },
  {
    title: "Bitcoin Timing - Early or Late?",
    description:
      "Worried you missed the boat? This perspective-shifting analysis reveals why we're still in Bitcoin's early adoption phase and what that means for you.",
    type: "Perspective",
    url: "https://www.youtubetrimmer.com/view/?v=5893JBg7r9k&start=773&end=1003&loop=0",
  },
  {
    title: "Bitcoin vs Diversification Myth",
    description:
      "Challenge conventional investment wisdom. Learn why concentrating in Bitcoin might be the smartest diversification strategy for the digital age.",
    type: "Strategy",
    url: "https://www.youtube.com/watch?v=kunaljk_Psc",
  },
  {
    title: "Federal Reserve - The Greatest Lie",
    description:
      "Shocking truth about America's central bank: it's neither federal nor has reserves. Understand the private institution that controls your money's value.",
    type: "Truth Bomb",
    url: "https://v.nostr.build/tIA2DN77tAW2qNgT.mp4",
  },
  {
    title: "Inflation - The Silent Wealth Thief",
    description:
      "Analysis of how inflation destroys the social fabric by eroding savings, widening inequality, and breaking the fundamental promise that hard work leads to prosperity.",
    type: "Wake-Up Call",
    url: "https://www.youtubetrimmer.com/view/?v=qfeMas1zU6Q&start=2327&end=2514&loop=0",
  },
];

export const videos: VideoResource[] = rawVideos.map((v) => ({
  ...v,
  slug: createVideoSlug(v.title),
}));

export const getVideoBySlug = (slug?: string): VideoResource | undefined =>
  slug ? videos.find((v) => v.slug === slug) : undefined;
