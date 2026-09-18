export interface ServiceProfile {
  id: string;
  name: string;
  shortDescription: string;
  focusAreas: string[];
  opportunityCategories: string[];
  systemInstructionContext: string;
}

export const DEFAULT_SERVICE_PROFILE_ID = "web_development";
