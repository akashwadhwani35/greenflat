export interface User {
  id: number;
  email: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  interested_in: 'male' | 'female' | 'both';
  date_of_birth: Date;
  city: string;
  latitude?: number;
  longitude?: number;
  distance_radius: number;
  is_verified: boolean;
  is_premium: boolean;
  premium_expires_at?: Date;
  cooldown_enabled: boolean;
  cooldown_until?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserProfile {
  id: number;
  user_id: number;
  height?: number;
  body_type?: string;
  interests?: string[];
  bio?: string;
  prompt1?: string;
  prompt2?: string;
  prompt3?: string;
  smoker?: boolean;
  drinker?: string;
  diet?: string;
  fitness_level?: string;
  education?: string;
  occupation?: string;
  relationship_goal?: string;
  family_oriented?: boolean;
  spiritual?: boolean;
  open_minded?: boolean;
  career_focused?: boolean;
}

export interface PersonalityResponse {
  id: number;
  user_id: number;
  question1_answer?: string;
  question2_answer?: string;
  question3_answer?: string;
  question4_answer?: string;
  question5_answer?: string;
  question6_answer?: string;
  question7_answer?: string;
  question8_answer?: string;
  personality_traits?: string[];
  personality_summary?: string;
  compatibility_tips?: string;
  top_traits?: string[];
}

export interface Photo {
  id: number;
  user_id: number;
  photo_url: string;
  is_primary: boolean;
  order_index: number;
}

export interface Like {
  id: number;
  liker_id: number;
  liked_id: number;
  is_on_grid: boolean;
  created_at: Date;
}

export interface Match {
  id: number;
  user1_id: number;
  user2_id: number;
  matched_at: Date;
}

export interface Message {
  id: number;
  match_id: number;
  sender_id: number;
  content: string;
  message_type: 'text' | 'image' | 'voice';
  is_read: boolean;
  created_at: Date;
}

export interface UserActivityLimits {
  id: number;
  user_id: number;
  on_grid_likes_count: number;
  off_grid_likes_count: number;
  messages_started_count: number;
  last_reset_at: Date;
}

export interface UserAIProfile {
  id: number;
  user_id: number;
  self_summary?: string;
  ideal_partner_prompt?: string;
  connection_preferences?: string;
  dealbreakers?: string;
  growth_journey?: string;
  persona_embedding?: number[];
  updated_at: Date;
  created_at: Date;
}

export interface SearchFilters {
  minAge?: number;
  maxAge?: number;
  minHeight?: number;
  maxHeight?: number;
  interests?: string[];
  city?: string;
  maxDistance?: number;
  smoker?: boolean;
  drinker?: string;
  relationship_goal?: string;
}

export interface MatchResult {
  user: User;
  profile: UserProfile;
  photos: Photo[];
  personality: PersonalityResponse;
  match_percentage: number;
  match_reason?: string;
}
