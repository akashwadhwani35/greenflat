/**
 * The chat currently on screen, shared between the chat screen and the push
 * handler so a message you are already reading never pops as a banner
 * (board 40). Server-side presence covers the same case for background
 * delivery; this is the last line of defence for the foreground.
 */
let activeMatchId: number | null = null;

export const setActiveChat = (matchId: number | null) => {
  activeMatchId = matchId;
};

export const getActiveChat = () => activeMatchId;
