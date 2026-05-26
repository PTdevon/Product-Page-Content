export interface WhyChooseThisEntry {
  id: string;
  productType: string;
  productStyle: string;
  category: "Stands Out" | "Gift Impact" | "Trusted Pick" | "Worth Keeping";
  text: string;
  subtext: string;
}

export interface PerfectForEntry {
  id: string;
  productType: string;
  productStyle: string;
  category: "Occasion" | "Person" | "Context";
  phrase: string;
  filterByInterest: boolean;
  timeSensitive: "mothers-day" | "fathers-day" | "valentines-day" | null;
  applicabilityCount: number;
  icon: string;
}

export interface ProductSummary {
  id: string;
  title: string;
  handle: string;
  featuredImage: string | null;
  productTypePt: string;
  productStylePt: string;
  classifyStatus: "complete" | "partial" | "missing";
  contentStatus: "complete" | "partial" | "missing";
}

export interface AppSettings {
  dateRanges: {
    mothersDay:    { start: string; end: string } | null;
    fathersDay:    { start: string; end: string } | null;
    valentinesDay: { start: string; end: string } | null;
  };
}
