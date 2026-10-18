export type ConversationStatus = 'active' | 'accepted' | 'declined' | 'completed' | 'cancelled';
export type MessageType = 'message' | 'offer' | 'system';
export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered';

export type ListingType = 'trade' | 'sale' | 'either';
export type ListingCondition =
  | 'Mint'
  | 'Near Mint'
  | 'Lightly Played'
  | 'Moderately Played'
  | 'Heavily Played';

export type Listing = {
  id: string;
  user_id: string;
  card_name: string;
  set_name: string;
  set_id: string;
  card_number: string;
  variant: string;
  condition: ListingCondition;
  listing_type: ListingType;
  price: number | null;
  trade_description: string | null;
  postcode_prefix: string | null;
  image_url: string | null;
  card_image_url: string | null;
  is_active: boolean;
};

export type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
  trade_listings: Listing[] | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string | null;
  message_type: MessageType;
  offer_amount: number | null;
  offer_status: OfferStatus | null;
  created_at: string;
  read_at: string | null;
};

export type PublicProfile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
};
