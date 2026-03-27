import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// CARD & DECK ENGINE
// ============================================================
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT_COLORS = { "♠": "#1a1a1a", "♣": "#1a1a1a", "♥": "#cc1122", "♦": "#cc1122" };

function createShoe(numDecks) {
  const cards = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit, id: `${rank}${suit}-${d}-${Math.random().toString(36).slice(2, 6)}` });
      }
    }
  }
  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  // Cut card placed ~75% through the shoe
  const cutPosition = Math.floor(cards.length * 0.75);
  return { cards, cutPosition, dealt: 0 };
}

function cardValue(rank) {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return parseInt(rank);
}

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  const soft = aces > 0 && total <= 21;
  return { total, soft, bust: total > 21, blackjack: cards.length === 2 && total === 21 };
}

// ============================================================
// BASIC STRATEGY ENGINE
// ============================================================
function getOptimalPlay(playerCards, dealerUpcard, canSplit, canDouble) {
  const pv = handValue(playerCards);
  const dv = cardValue(dealerUpcard.rank);
  const t = pv.total;

  // Pairs
  if (canSplit && playerCards.length === 2 && playerCards[0].rank === playerCards[1].rank) {
    const pr = playerCards[0].rank;
    if (pr === "A") return { action: "split", reason: "Always split Aces" };
    if (pr === "8") return { action: "split", reason: "Always split 8s" };
    if (pr === "10" || pr === "J" || pr === "Q" || pr === "K") return { action: "stand", reason: "Never split 10-value cards — 20 is too strong" };
    if (pr === "5") return dv >= 2 && dv <= 9 ? { action: "double", reason: "Double 10 vs dealer 2-9" } : { action: "hit", reason: "Hit 10 vs dealer 10/A" };
    if (pr === "4") return { action: "hit", reason: "Never split 4s" };
    if (pr === "9") {
      if (dv === 7 || dv === 10 || dv === 11) return { action: "stand", reason: "Stand 18 (9s) vs 7/10/A" };
      if (dv >= 2 && dv <= 6 || dv === 8 || dv === 9) return { action: "split", reason: "Split 9s vs 2-6, 8-9" };
    }
    if (pr === "7") return dv >= 2 && dv <= 7 ? { action: "split", reason: "Split 7s vs 2-7" } : { action: "hit", reason: "Hit 14 vs 8+" };
    if (pr === "6") return dv >= 3 && dv <= 6 ? { action: "split", reason: "Split 6s vs 3-6" } : { action: "hit", reason: "Hit 12 vs 2 or 7+" };
    if (pr === "3" || pr === "2") return dv >= 4 && dv <= 7 ? { action: "split", reason: "Split 2s/3s vs 4-7" } : { action: "hit", reason: "Hit low pair vs other" };
  }

  // Soft hands
  if (pv.soft && t >= 13 && t <= 21) {
    if (t >= 20) return { action: "stand", reason: "Always stand soft 20+" };
    if (t === 19) return { action: "stand", reason: "Stand soft 19" };
    if (t === 18) {
      if (dv >= 3 && dv <= 6 && canDouble) return { action: "double", reason: "Double soft 18 vs 3-6" };
      if (dv === 2 || dv === 7 || dv === 8) return { action: "stand", reason: "Stand soft 18 vs 2/7/8" };
      return { action: "hit", reason: "Hit soft 18 vs 9/10/A" };
    }
    if (t === 17) {
      if (dv >= 3 && dv <= 6 && canDouble) return { action: "double", reason: "Double soft 17 vs 3-6" };
      return { action: "hit", reason: "Hit soft 17" };
    }
    if (t === 16 || t === 15) {
      if (dv >= 4 && dv <= 6 && canDouble) return { action: "double", reason: `Double soft ${t} vs 4-6` };
      return { action: "hit", reason: `Hit soft ${t}` };
    }
    if (t <= 14) return { action: "hit", reason: `Hit soft ${t}` };
  }

  // Hard hands
  if (t >= 17) return { action: "stand", reason: "Always stand hard 17+" };
  if (t >= 13 && t <= 16) {
    return dv >= 2 && dv <= 6
      ? { action: "stand", reason: `Stand ${t} vs dealer ${dv} (dealer likely busts)` }
      : { action: "hit", reason: `Hit ${t} vs dealer ${dv} (dealer likely makes hand)` };
  }
  if (t === 12) {
    return dv >= 4 && dv <= 6
      ? { action: "stand", reason: "Stand 12 vs 4-6" }
      : { action: "hit", reason: "Hit 12 vs 2/3 or 7+" };
  }
  if (t === 11) {
    if (canDouble && dv !== 11) return { action: "double", reason: "Double 11 vs 2-10" };
    return { action: "hit", reason: "Hit 11" };
  }
  if (t === 10) {
    if (canDouble && dv >= 2 && dv <= 9) return { action: "double", reason: "Double 10 vs 2-9" };
    return { action: "hit", reason: "Hit 10" };
  }
  if (t === 9) {
    if (canDouble && dv >= 3 && dv <= 6) return { action: "double", reason: "Double 9 vs 3-6" };
    return { action: "hit", reason: "Hit 9" };
  }
  return { action: "hit", reason: `Hit ${t} — always hit 8 or below` };
}

// ============================================================
// STYLES
// ============================================================
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=JetBrains+Mono:wght@400;600&family=DM+Sans:wght@400;500;600;700&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

const colors = {
  felt: "#0a5c36",
  feltDark: "#064728",
  feltLight: "#0d7a48",
  gold: "#d4a843",
  goldLight: "#f0d078",
  goldDim: "#8a7230",
  bg: "#0d0d0d",
  surface: "#1a1a1a",
  surfaceLight: "#252525",
  text: "#f0efe8",
  textDim: "#8a8880",
  red: "#e74c3c",
  green: "#27ae60",
  blue: "#3498db",
  cardWhite: "#faf9f6",
  cardShadow: "rgba(0,0,0,0.5)",
};

// ============================================================
// CARD COMPONENT
// ============================================================
function Card({ card, hidden, small, dealt }) {
  const w = small ? 56 : 80;
  const h = small ? 80 : 116;
  const fontSize = small ? 15 : 22;
  const suitSize = small ? 20 : 32;

  const baseStyle = {
    width: w, height: h, borderRadius: 8,
    display: "inline-flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    margin: small ? "0 2px" : "0 4px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 700,
    boxShadow: `2px 4px 12px ${colors.cardShadow}`,
    transition: "transform 0.3s ease, opacity 0.3s ease",
    transform: dealt ? "translateY(0) scale(1)" : "translateY(-20px) scale(0.8)",
    opacity: dealt ? 1 : 0,
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
  };

  if (hidden) {
    return (
      <div style={{
        ...baseStyle,
        background: `repeating-linear-gradient(45deg, #1a3a6e, #1a3a6e 4px, #1e4080 4px, #1e4080 8px)`,
        border: "2px solid #2a5090",
      }}>
        <div style={{
          width: "60%", height: "70%", border: "2px solid #3060a0",
          borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: suitSize, color: "#4080c0",
        }}>♠</div>
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit];
  return (
    <div style={{
      ...baseStyle,
      background: colors.cardWhite,
      border: "2px solid #ccc",
      color: color,
    }}>
      <div style={{ fontSize, lineHeight: 1, fontWeight: 900 }}>{card.rank}</div>
      <div style={{ fontSize: suitSize, lineHeight: 1, marginTop: 4 }}>{card.suit}</div>
    </div>
  );
}

// ============================================================
// CHIP COMPONENT
// ============================================================
function Chip({ value, onClick, disabled }) {
  const chipColors = {
    1: { bg: "#f0f0f0", border: "#ccc", label: "$1", textColor: "#333" },
    5: { bg: "#c0392b", border: "#e74c3c", label: "$5", textColor: "white" },
    10: { bg: "#2471a3", border: "#3498db", label: "$10", textColor: "white" },
    25: { bg: "#1e8449", border: "#27ae60", label: "$25", textColor: "white" },
    50: { bg: "#6c3483", border: "#8e44ad", label: "$50", textColor: "white" },
    100: { bg: "#1a1a1a", border: "#444", label: "$100", textColor: "white" },
  };
  const c = chipColors[value] || chipColors[1];
  return (
    <button
      onClick={() => !disabled && onClick(value)}
      disabled={disabled}
      style={{
        width: 52, height: 52, borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, ${c.border}, ${c.bg})`,
        border: `3px solid ${c.border}`,
        color: c.textColor, fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: `1px 2px 6px rgba(0,0,0,0.4)`,
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s ease",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.9)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >{c.label}</button>
  );
}

// ============================================================
// MAIN APP
// ============================================================
const INITIAL_BANKROLL = 200;
const PHASES = { BETTING: "betting", PLAYING: "playing", DEALER: "dealer", RESULT: "result", SETTINGS: "settings", ANALYTICS: "analytics" };

export default function BlackjackApp() {
  // Settings
  const [numDecks, setNumDecks] = useState(6);
  const [showAdvisor, setShowAdvisor] = useState(true);
  const [dealerStandsSoft17, setDealerStandsSoft17] = useState(true);

  // Game state
  const [shoe, setShoe] = useState(() => createShoe(6));
  const [phase, setPhase] = useState(PHASES.SETTINGS);
  const [bankroll, setBankroll] = useState(INITIAL_BANKROLL);
  const [initialBankroll, setInitialBankroll] = useState(INITIAL_BANKROLL);
  const [currentBet, setCurrentBet] = useState(0);
  const [playerHands, setPlayerHands] = useState([[]]);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [dealerCards, setDealerCards] = useState([]);
  const [handBets, setHandBets] = useState([0]);
  const [handResults, setHandResults] = useState([]);
  const [message, setMessage] = useState("");
  const [dealerRevealed, setDealerRevealed] = useState(false);
  const [cardsDealt, setCardsDealt] = useState({});

  // Analytics
  const [sessionHistory, setSessionHistory] = useState([]);
  const [handsPlayed, setHandsPlayed] = useState(0);
  const [handsWon, setHandsWon] = useState(0);
  const [handsLost, setHandsLost] = useState(0);
  const [handsPushed, setHandsPushed] = useState(0);
  const [totalWagered, setTotalWagered] = useState(0);
  const [totalWinnings, setTotalWinnings] = useState(0);
  const [blackjackCount, setBlackjackCount] = useState(0);
  const [doubleDownCount, setDoubleDownCount] = useState(0);
  const [splitCount, setSplitCount] = useState(0);
  const [correctPlays, setCorrectPlays] = useState(0);
  const [totalPlays, setTotalPlays] = useState(0);
  const [streakCurrent, setStreakCurrent] = useState(0);
  const [streakBest, setStreakBest] = useState(0);
  const [streakWorst, setStreakWorst] = useState(0);
  const [bankrollHistory, setBankrollHistory] = useState([INITIAL_BANKROLL]);

  // Win progression state
  const [consecutiveWins, setConsecutiveWins] = useState(0);
  const [lastBet, setLastBet] = useState(10);

  const dealTimerRef = useRef(null);

  const markDealt = useCallback((id) => {
    setCardsDealt(prev => ({ ...prev, [id]: true }));
    // Auto-mark as dealt after a brief delay for animation
  }, []);

  // Deal a card from shoe
  function dealCard(currentShoe) {
    if (currentShoe.dealt >= currentShoe.cards.length) {
      const newShoe = createShoe(numDecks);
      const card = newShoe.cards[0];
      newShoe.dealt = 1;
      return { card, shoe: newShoe, reshuffled: true };
    }
    const card = currentShoe.cards[currentShoe.dealt];
    return { card, shoe: { ...currentShoe, dealt: currentShoe.dealt + 1 }, reshuffled: false };
  }

  // Start new hand
  function startHand() {
    // Check if shoe needs reshuffling
    let currentShoe = shoe;
    if (currentShoe.dealt >= currentShoe.cutPosition) {
      currentShoe = createShoe(numDecks);
      setMessage("Shoe reshuffled!");
    }

    const bet = currentBet;
    setBankroll(b => b - bet);
    setTotalWagered(w => w + bet);
    setHandBets([bet]);
    setHandResults([]);
    setDealerRevealed(false);
    setCardsDealt({});

    // Deal initial cards
    let s = currentShoe;
    const pCards = [];
    const dCards = [];

    let r = dealCard(s); pCards.push(r.card); s = r.shoe;
    r = dealCard(s); dCards.push(r.card); s = r.shoe;
    r = dealCard(s); pCards.push(r.card); s = r.shoe;
    r = dealCard(s); dCards.push(r.card); s = r.shoe;

    setShoe(s);
    setPlayerHands([pCards]);
    setDealerCards(dCards);
    setActiveHandIndex(0);

    // Animate cards appearing
    setTimeout(() => {
      setCardsDealt(prev => ({ ...prev, [pCards[0].id]: true }));
    }, 100);
    setTimeout(() => {
      setCardsDealt(prev => ({ ...prev, [dCards[0].id]: true }));
    }, 250);
    setTimeout(() => {
      setCardsDealt(prev => ({ ...prev, [pCards[1].id]: true }));
    }, 400);
    setTimeout(() => {
      setCardsDealt(prev => ({ ...prev, [dCards[1].id]: true }));
    }, 550);

    // Check for immediate blackjack
    setTimeout(() => {
      const pv = handValue(pCards);
      const dv = handValue(dCards);
      if (pv.blackjack && dv.blackjack) {
        setDealerRevealed(true);
        resolveResults([pCards], dCards, [bet], true);
      } else if (pv.blackjack) {
        setDealerRevealed(true);
        resolveResults([pCards], dCards, [bet], true);
      } else if (dv.blackjack) {
        setDealerRevealed(true);
        resolveResults([pCards], dCards, [bet], true);
      } else {
        setPhase(PHASES.PLAYING);
      }
    }, 700);
  }

  // Player actions
  function handleHit() {
    const optimal = getOptimalPlay(
      playerHands[activeHandIndex],
      dealerCards[0],
      canSplit(),
      canDouble()
    );
    setTotalPlays(p => p + 1);
    if (optimal.action === "hit") setCorrectPlays(c => c + 1);

    const r = dealCard(shoe);
    setShoe(r.shoe);
    const newHands = [...playerHands];
    newHands[activeHandIndex] = [...newHands[activeHandIndex], r.card];
    setPlayerHands(newHands);
    setTimeout(() => setCardsDealt(prev => ({ ...prev, [r.card.id]: true })), 50);

    const pv = handValue(newHands[activeHandIndex]);
    if (pv.bust || pv.total === 21) {
      advanceHand(newHands);
    }
  }

  function handleStand() {
    const optimal = getOptimalPlay(
      playerHands[activeHandIndex],
      dealerCards[0],
      canSplit(),
      canDouble()
    );
    setTotalPlays(p => p + 1);
    if (optimal.action === "stand") setCorrectPlays(c => c + 1);

    advanceHand(playerHands);
  }

  function handleDouble() {
    const optimal = getOptimalPlay(
      playerHands[activeHandIndex],
      dealerCards[0],
      canSplit(),
      canDouble()
    );
    setTotalPlays(p => p + 1);
    if (optimal.action === "double") setCorrectPlays(c => c + 1);

    const bet = handBets[activeHandIndex];
    setBankroll(b => b - bet);
    setTotalWagered(w => w + bet);
    const newBets = [...handBets];
    newBets[activeHandIndex] = bet * 2;
    setHandBets(newBets);
    setDoubleDownCount(c => c + 1);

    const r = dealCard(shoe);
    setShoe(r.shoe);
    const newHands = [...playerHands];
    newHands[activeHandIndex] = [...newHands[activeHandIndex], r.card];
    setPlayerHands(newHands);
    setTimeout(() => setCardsDealt(prev => ({ ...prev, [r.card.id]: true })), 50);

    advanceHand(newHands);
  }

  function handleSplit() {
    const optimal = getOptimalPlay(
      playerHands[activeHandIndex],
      dealerCards[0],
      canSplit(),
      canDouble()
    );
    setTotalPlays(p => p + 1);
    if (optimal.action === "split") setCorrectPlays(c => c + 1);

    const hand = playerHands[activeHandIndex];
    const bet = handBets[activeHandIndex];
    setBankroll(b => b - bet);
    setTotalWagered(w => w + bet);
    setSplitCount(c => c + 1);

    let s = shoe;
    const r1 = dealCard(s); s = r1.shoe;
    const r2 = dealCard(s); s = r2.shoe;
    setShoe(s);

    const newHands = [...playerHands];
    newHands[activeHandIndex] = [hand[0], r1.card];
    newHands.splice(activeHandIndex + 1, 0, [hand[1], r2.card]);
    setPlayerHands(newHands);

    const newBets = [...handBets];
    newBets.splice(activeHandIndex + 1, 0, bet);
    setHandBets(newBets);

    setTimeout(() => {
      setCardsDealt(prev => ({ ...prev, [r1.card.id]: true, [r2.card.id]: true }));
    }, 50);

    // If split aces, one card each then done
    if (hand[0].rank === "A") {
      setTimeout(() => advanceHand(newHands, activeHandIndex, newHands.length), 200);
    }
  }

  function advanceHand(hands, fromIndex = activeHandIndex) {
    const nextIndex = fromIndex + 1;
    if (nextIndex < hands.length) {
      setActiveHandIndex(nextIndex);
    } else {
      // All hands done, dealer's turn
      playDealer(hands);
    }
  }

  function playDealer(finalPlayerHands) {
    setDealerRevealed(true);
    setPhase(PHASES.DEALER);

    // Check if all player hands busted
    const allBusted = finalPlayerHands.every(h => handValue(h).bust);
    if (allBusted) {
      resolveResults(finalPlayerHands, dealerCards, handBets, false);
      return;
    }

    let dCards = [...dealerCards];
    let s = shoe;

    function dealerDraw() {
      const dv = handValue(dCards);
      const shouldHit = dv.total < 17 || (!dealerStandsSoft17 && dv.soft && dv.total === 17);
      if (shouldHit) {
        const r = dealCard(s);
        s = r.shoe;
        dCards = [...dCards, r.card];
        setDealerCards([...dCards]);
        setShoe(s);
        setTimeout(() => {
          setCardsDealt(prev => ({ ...prev, [r.card.id]: true }));
          setTimeout(dealerDraw, 400);
        }, 50);
      } else {
        resolveResults(finalPlayerHands, dCards, handBets, false);
      }
    }

    setTimeout(dealerDraw, 500);
  }

  function resolveResults(pHands, dCards, bets, immediate) {
    const dv = handValue(dCards);
    const results = [];

    pHands.forEach((hand, i) => {
      const pv = handValue(hand);
      const bet = bets[i];
      let result, payout;

      if (pv.bust) {
        result = "lose"; payout = 0;
      } else if (pv.blackjack && !dv.blackjack) {
        result = "blackjack"; payout = bet + bet * 1.5; // 3:2
        setBlackjackCount(c => c + 1);
      } else if (dv.blackjack && !pv.blackjack) {
        result = "lose"; payout = 0;
      } else if (pv.blackjack && dv.blackjack) {
        result = "push"; payout = bet;
      } else if (dv.bust) {
        result = "win"; payout = bet * 2;
      } else if (pv.total > dv.total) {
        result = "win"; payout = bet * 2;
      } else if (pv.total < dv.total) {
        result = "lose"; payout = 0;
      } else {
        result = "push"; payout = bet;
      }

      results.push({ result, payout, bet });
      setBankroll(b => b + payout);
      setTotalWinnings(w => w + payout);

      if (result === "win" || result === "blackjack") {
        setHandsWon(w => w + 1);
        setStreakCurrent(s => {
          const ns = s >= 0 ? s + 1 : 1;
          setStreakBest(b => Math.max(b, ns));
          return ns;
        });
      } else if (result === "lose") {
        setHandsLost(l => l + 1);
        setStreakCurrent(s => {
          const ns = s <= 0 ? s - 1 : -1;
          setStreakWorst(w => Math.min(w, ns));
          return ns;
        });
      } else {
        setHandsPushed(p => p + 1);
      }
    });

    setHandsPlayed(h => h + 1);
    setHandResults(results);
    setPhase(PHASES.RESULT);

    // Update bankroll history
    setBankrollHistory(prev => {
      const totalPayout = results.reduce((s, r) => s + r.payout, 0);
      const totalBet = bets.reduce((s, b) => s + b, 0);
      const newBankroll = prev[prev.length - 1] + totalPayout - totalBet;
      return [...prev, bankroll + results.reduce((s, r) => s + r.payout, 0)];
    });

    // Session history entry
    const totalPayout = results.reduce((s, r) => s + r.payout, 0);
    const totalBetThisHand = bets.reduce((s, b) => s + b, 0);
    setSessionHistory(prev => [...prev, {
      hand: prev.length + 1,
      bet: totalBetThisHand,
      result: results.map(r => r.result).join("/"),
      payout: totalPayout,
      net: totalPayout - totalBetThisHand,
      playerTotal: pHands.map(h => handValue(h).total).join("/"),
      dealerTotal: dv.total,
    }]);

    // Win progression
    const mainResult = results[0]?.result;
    if (mainResult === "win" || mainResult === "blackjack") {
      setConsecutiveWins(w => {
        if (w + 1 >= 3) {
          setLastBet(Math.max(1, Math.floor(initialBankroll / 20)));
          return 0;
        }
        setLastBet(Math.min(Math.ceil(currentBet * 1.5), Math.floor(bankroll / 4)));
        return w + 1;
      });
    } else {
      setConsecutiveWins(0);
      setLastBet(Math.max(1, Math.floor(initialBankroll / 20)));
    }
  }

  function canSplit() {
    if (playerHands[activeHandIndex]?.length !== 2) return false;
    if (playerHands.length >= 4) return false;
    const h = playerHands[activeHandIndex];
    const sameRank = h[0].rank === h[1].rank;
    const sameTenVal = cardValue(h[0].rank) === 10 && cardValue(h[1].rank) === 10;
    return (sameRank || sameTenVal) && bankroll >= handBets[activeHandIndex];
  }

  function canDouble() {
    return playerHands[activeHandIndex]?.length === 2 && bankroll >= handBets[activeHandIndex];
  }

  // Suggested bet based on win progression
  function suggestedBet() {
    const minBet = Math.max(1, Math.floor(initialBankroll / 20));
    return Math.min(lastBet, bankroll, Math.floor(bankroll / 2));
  }

  // ============================================================
  // RENDER
  // ============================================================

  // Settings screen
  if (phase === PHASES.SETTINGS) {
    const stepperBtn = (label, onClick, disabled) => (
      <button onClick={onClick} disabled={disabled} style={{
        width: 40, height: 40, borderRadius: 8,
        background: disabled ? colors.surfaceLight : colors.gold,
        color: disabled ? colors.textDim : colors.bg,
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 900, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'JetBrains Mono', monospace",
      }}>{label}</button>
    );

    return (
      <div style={{
        minHeight: "100vh", background: colors.bg,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: 20, fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{
          maxWidth: 440, width: "100%", padding: 40, borderRadius: 16,
          background: colors.surface, border: `1px solid ${colors.goldDim}33`,
          boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
        }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif", fontSize: 32,
            color: colors.gold, textAlign: "center", margin: 0, marginBottom: 8,
          }}>♠ BROKE-N-BORED</h1>
          <p style={{ textAlign: "center", color: colors.textDim, margin: 0, marginBottom: 32, fontSize: 13, letterSpacing: 3, textTransform: "uppercase" }}>
            Blackjack Trainer
          </p>

          {/* Deck selector */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: colors.text, fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>
              Number of Decks
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[1, 2, 4, 6, 8].map(n => (
                <button key={n} onClick={() => setNumDecks(n)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  background: numDecks === n ? colors.gold : colors.surfaceLight,
                  color: numDecks === n ? colors.bg : colors.text,
                  border: "none", cursor: "pointer", fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>{n}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
              {stepperBtn("−", () => setNumDecks(d => Math.max(1, d - 1)), numDecks <= 1)}
              <div style={{
                padding: "8px 20px", borderRadius: 8, minWidth: 60, textAlign: "center",
                background: colors.surfaceLight, border: `1px solid ${colors.goldDim}44`,
                color: colors.gold, fontFamily: "'JetBrains Mono', monospace",
                fontSize: 18, fontWeight: 800,
              }}>{numDecks}</div>
              {stepperBtn("+", () => setNumDecks(d => Math.min(12, d + 1)), numDecks >= 12)}
            </div>
          </div>

          {/* Buy-in selector */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: colors.text, fontSize: 14, fontWeight: 600, display: "block", marginBottom: 8 }}>
              Buy-in Amount
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[50, 100, 200, 500, 1000].map(n => (
                <button key={n} onClick={() => { setInitialBankroll(n); setBankroll(n); setBankrollHistory([n]); }} style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  background: initialBankroll === n ? colors.gold : colors.surfaceLight,
                  color: initialBankroll === n ? colors.bg : colors.text,
                  border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>${n}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              {stepperBtn("−", () => {
                const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
                const prev = [...steps].reverse().find(s => s < initialBankroll) || 10;
                setInitialBankroll(prev); setBankroll(prev); setBankrollHistory([prev]);
              }, initialBankroll <= 10)}
              <div style={{
                padding: "8px 20px", borderRadius: 8, minWidth: 90, textAlign: "center",
                background: colors.surfaceLight, border: `1px solid ${colors.goldDim}44`,
                color: colors.gold, fontFamily: "'JetBrains Mono', monospace",
                fontSize: 18, fontWeight: 800,
              }}>${initialBankroll}</div>
              {stepperBtn("+", () => {
                const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
                const next = steps.find(s => s > initialBankroll) || initialBankroll + 1000;
                setInitialBankroll(next); setBankroll(next); setBankrollHistory([next]);
              }, initialBankroll >= 10000)}
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8 }}>
              {[1, 5, 10, 25].map(v => (
                <button key={v} onClick={() => {
                  const n = initialBankroll + v;
                  setInitialBankroll(n); setBankroll(n); setBankrollHistory([n]);
                }} style={{
                  padding: "6px 10px", borderRadius: 6,
                  background: colors.surfaceLight, border: `1px solid ${colors.goldDim}22`,
                  color: colors.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>+${v}</button>
              ))}
              {[1, 5, 10, 25].map(v => (
                <button key={`m${v}`} onClick={() => {
                  const n = Math.max(1, initialBankroll - v);
                  setInitialBankroll(n); setBankroll(n); setBankrollHistory([n]);
                }} style={{
                  padding: "6px 10px", borderRadius: 6,
                  background: colors.surfaceLight, border: `1px solid ${colors.goldDim}22`,
                  color: colors.textDim, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>-${v}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: colors.text, fontSize: 14 }}>
              <input type="checkbox" checked={dealerStandsSoft17} onChange={() => setDealerStandsSoft17(!dealerStandsSoft17)}
                style={{ accentColor: colors.gold, width: 18, height: 18 }} />
              Dealer stands on soft 17
            </label>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: colors.text, fontSize: 14 }}>
              <input type="checkbox" checked={showAdvisor} onChange={() => setShowAdvisor(!showAdvisor)}
                style={{ accentColor: colors.gold, width: 18, height: 18 }} />
              Show strategy advisor
            </label>
          </div>

          <button onClick={() => {
            setShoe(createShoe(numDecks));
            setCurrentBet(0);
            setPhase(PHASES.BETTING);
          }} style={{
            width: "100%", padding: "14px 0", borderRadius: 10,
            background: `linear-gradient(135deg, ${colors.gold}, ${colors.goldDim})`,
            border: "none", color: colors.bg, fontWeight: 800, fontSize: 16,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            letterSpacing: 1,
          }}>TAKE A SEAT</button>
        </div>
      </div>
    );
  }

  // Analytics screen
  if (phase === PHASES.ANALYTICS) {
    const winRate = handsPlayed ? ((handsWon / handsPlayed) * 100).toFixed(1) : "0.0";
    const netProfit = bankroll - initialBankroll;
    const roi = totalWagered ? ((netProfit / totalWagered) * 100).toFixed(2) : "0.00";
    const accuracy = totalPlays ? ((correctPlays / totalPlays) * 100).toFixed(1) : "0.0";
    const avgBet = handsPlayed ? (totalWagered / handsPlayed).toFixed(0) : "0";
    const shoeProgress = shoe.cards.length ? ((shoe.dealt / shoe.cards.length) * 100).toFixed(0) : "0";

    // Simple sparkline of bankroll
    const maxB = Math.max(...bankrollHistory, initialBankroll);
    const minB = Math.min(...bankrollHistory, 0);
    const range = maxB - minB || 1;

    return (
      <div style={{
        minHeight: "100vh", background: colors.bg, padding: 16,
        fontFamily: "'DM Sans', sans-serif", color: colors.text,
      }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: colors.gold, margin: 0, fontSize: 24 }}>Session Analytics</h2>
            <button onClick={() => setPhase(PHASES.BETTING)} style={{
              background: colors.surfaceLight, border: `1px solid ${colors.goldDim}44`,
              color: colors.text, padding: "8px 16px", borderRadius: 8, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
            }}>Back to Table</button>
          </div>

          {/* Key metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Net P/L", value: `${netProfit >= 0 ? "+" : ""}$${netProfit.toFixed(0)}`, color: netProfit >= 0 ? colors.green : colors.red },
              { label: "Bankroll", value: `$${bankroll.toFixed(0)}`, color: colors.gold },
              { label: "Win Rate", value: `${winRate}%`, color: colors.blue },
              { label: "Hands", value: handsPlayed, color: colors.text },
              { label: "Strategy", value: `${accuracy}%`, color: parseFloat(accuracy) >= 80 ? colors.green : colors.red },
              { label: "ROI", value: `${roi}%`, color: parseFloat(roi) >= 0 ? colors.green : colors.red },
            ].map((m, i) => (
              <div key={i} style={{
                background: colors.surface, borderRadius: 10, padding: "12px 14px",
                border: `1px solid ${colors.goldDim}22`,
              }}>
                <div style={{ fontSize: 11, color: colors.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Bankroll chart */}
          {bankrollHistory.length > 1 && (
            <div style={{
              background: colors.surface, borderRadius: 12, padding: 16,
              border: `1px solid ${colors.goldDim}22`, marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Bankroll Over Time</div>
              <svg viewBox={`0 0 ${Math.max(bankrollHistory.length * 8, 200)} 80`} style={{ width: "100%", height: 80 }}>
                <line x1="0" y1={80 - ((initialBankroll - minB) / range) * 72 - 4} x2={bankrollHistory.length * 8} y2={80 - ((initialBankroll - minB) / range) * 72 - 4}
                  stroke={colors.goldDim} strokeWidth="0.5" strokeDasharray="4 2" />
                <polyline fill="none" stroke={netProfit >= 0 ? colors.green : colors.red} strokeWidth="2"
                  points={bankrollHistory.map((b, i) => `${i * 8},${80 - ((b - minB) / range) * 72 - 4}`).join(" ")} />
                {bankrollHistory.length > 0 && (
                  <circle cx={(bankrollHistory.length - 1) * 8} cy={80 - ((bankrollHistory[bankrollHistory.length - 1] - minB) / range) * 72 - 4}
                    r="3" fill={netProfit >= 0 ? colors.green : colors.red} />
                )}
              </svg>
            </div>
          )}

          {/* Detailed stats */}
          <div style={{
            background: colors.surface, borderRadius: 12, padding: 16,
            border: `1px solid ${colors.goldDim}22`, marginBottom: 20,
          }}>
            <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Breakdown</div>
            {[
              { label: "Won / Lost / Push", value: `${handsWon} / ${handsLost} / ${handsPushed}` },
              { label: "Blackjacks", value: blackjackCount },
              { label: "Double Downs", value: doubleDownCount },
              { label: "Splits", value: splitCount },
              { label: "Total Wagered", value: `$${totalWagered}` },
              { label: "Avg Bet", value: `$${avgBet}` },
              { label: "Best Streak", value: `+${streakBest}` },
              { label: "Worst Streak", value: `${streakWorst}` },
              { label: "Shoe Progress", value: `${shoeProgress}%` },
            ].map((row, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", padding: "6px 0",
                borderBottom: `1px solid ${colors.surfaceLight}`,
                fontSize: 14,
              }}>
                <span style={{ color: colors.textDim }}>{row.label}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Hand history */}
          {sessionHistory.length > 0 && (
            <div style={{
              background: colors.surface, borderRadius: 12, padding: 16,
              border: `1px solid ${colors.goldDim}22`,
            }}>
              <div style={{ fontSize: 12, color: colors.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Hand History</div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {[...sessionHistory].reverse().map((h, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", padding: "5px 0",
                    borderBottom: `1px solid ${colors.surfaceLight}`, fontSize: 13,
                  }}>
                    <span style={{ color: colors.textDim, fontFamily: "'JetBrains Mono', monospace", width: 30 }}>#{h.hand}</span>
                    <span style={{ color: colors.textDim }}>Bet ${h.bet}</span>
                    <span style={{ color: colors.textDim }}>{h.playerTotal} vs {h.dealerTotal}</span>
                    <span style={{
                      color: h.net > 0 ? colors.green : h.net < 0 ? colors.red : colors.textDim,
                      fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", width: 60, textAlign: "right",
                    }}>{h.net >= 0 ? "+" : ""}${h.net}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export session */}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button onClick={() => {
              const exportData = {
                exportedAt: new Date().toISOString(),
                appVersion: "BROKE-N-BORED Blackjack Trainer v1.0",
                settings: {
                  numDecks,
                  initialBankroll,
                  dealerStandsSoft17,
                },
                summary: {
                  finalBankroll: bankroll,
                  netProfit: parseFloat(netProfit.toFixed(2)),
                  handsPlayed,
                  handsWon,
                  handsLost,
                  handsPushed,
                  winRate: parseFloat(winRate),
                  roi: parseFloat(roi),
                  strategyAccuracy: parseFloat(accuracy),
                  totalWagered,
                  totalWinnings,
                  avgBet: parseFloat(avgBet),
                  blackjackCount,
                  doubleDownCount,
                  splitCount,
                  streakBest,
                  streakWorst,
                },
                bankrollHistory,
                sessionHistory,
                // AI analysis prompt
                analysisPrompt: "This is a blackjack session export from BROKE-N-BORED Blackjack Trainer. Please analyze: 1) Overall performance vs expected house edge. 2) Strategy accuracy and which hands I'm playing wrong. 3) Betting patterns and bankroll management. 4) Specific recommendations to improve. The 'sessionHistory' array contains every hand played with bet amount, player/dealer totals, result, and net profit/loss.",
                // Raw stats for AI consumption
                handsPlayed,
                handsWon,
                handsLost,
                handsPushed,
                totalWagered,
                totalWinnings,
                blackjackCount,
                doubleDownCount,
                splitCount,
                correctPlays,
                totalPlays,
                streakBest,
                streakWorst,
              };

              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
              a.href = url;
              a.download = `blackjack-session-${timestamp}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }} style={{
              flex: 1, padding: "12px 0", borderRadius: 10,
              background: `linear-gradient(135deg, ${colors.gold}, ${colors.goldDim})`,
              border: "none", color: colors.bg, fontWeight: 800, fontSize: 14,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              letterSpacing: 0.5,
            }}>💾 Save Session</button>
            <button onClick={() => {
              const exportData = {
                exportedAt: new Date().toISOString(),
                settings: { numDecks, initialBankroll, dealerStandsSoft17 },
                summary: { finalBankroll: bankroll, netProfit: parseFloat(netProfit.toFixed(2)), handsPlayed, handsWon, handsLost, handsPushed, winRate: parseFloat(winRate), strategyAccuracy: parseFloat(accuracy), totalWagered, blackjackCount, doubleDownCount, splitCount, streakBest, streakWorst },
                bankrollHistory,
                sessionHistory,
              };
              const csvRows = [
                "Hand,Bet,PlayerTotal,DealerTotal,Result,Payout,Net",
                ...sessionHistory.map(h => `${h.hand},${h.bet},${h.playerTotal},${h.dealerTotal},${h.result},${h.payout},${h.net}`)
              ];
              const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
              a.href = url;
              a.download = `blackjack-session-${timestamp}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }} style={{
              flex: 1, padding: "12px 0", borderRadius: 10,
              background: colors.surfaceLight, border: `1px solid ${colors.goldDim}33`,
              color: colors.text, fontWeight: 700, fontSize: 14,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>📊 Export CSV</button>
          </div>

          <p style={{ fontSize: 11, color: colors.textDim, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
            JSON includes an AI analysis prompt — upload directly to Claude or ChatGPT for strategy review. CSV works for spreadsheets.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN GAME TABLE
  // ============================================================
  const activeHand = playerHands[activeHandIndex] || [];
  const pv = handValue(activeHand);
  const dvVisible = dealerRevealed ? handValue(dealerCards) : handValue([dealerCards[0] || { rank: "A", suit: "♠" }]);
  const optimal = phase === PHASES.PLAYING && activeHand.length >= 2 && dealerCards.length >= 1
    ? getOptimalPlay(activeHand, dealerCards[0], canSplit(), canDouble())
    : null;

  const isBetting = phase === PHASES.BETTING;
  const isPlaying = phase === PHASES.PLAYING;
  const isResult = phase === PHASES.RESULT;
  const netProfit = bankroll - initialBankroll;

  // Result message
  let resultMsg = "";
  let resultColor = colors.text;
  if (isResult && handResults.length > 0) {
    const totalNet = handResults.reduce((s, r) => s + r.payout - r.bet, 0);
    if (handResults.some(r => r.result === "blackjack")) { resultMsg = "BLACKJACK!"; resultColor = colors.gold; }
    else if (totalNet > 0) { resultMsg = `WIN +$${totalNet}`; resultColor = colors.green; }
    else if (totalNet < 0) { resultMsg = `LOSE -$${Math.abs(totalNet)}`; resultColor = colors.red; }
    else { resultMsg = "PUSH"; resultColor = colors.textDim; }
  }

  // Check for session over
  const sessionOver = bankroll <= 0 || bankroll >= initialBankroll * 2;

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at 50% 30%, ${colors.feltLight}, ${colors.felt} 50%, ${colors.feltDark})`,
      fontFamily: "'DM Sans', sans-serif",
      color: colors.text,
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      {/* Felt texture overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        pointerEvents: "none",
      }} />

      {/* Top bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 16px", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)",
        borderBottom: `1px solid rgba(212,168,67,0.15)`, position: "relative", zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 11, color: colors.goldDim, letterSpacing: 2, textTransform: "uppercase" }}>Bankroll</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: colors.gold, fontFamily: "'JetBrains Mono', monospace" }}>
            ${bankroll.toFixed(0)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <span style={{
            fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
            color: netProfit >= 0 ? colors.green : colors.red,
          }}>{netProfit >= 0 ? "+" : ""}${netProfit.toFixed(0)}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPhase(PHASES.ANALYTICS)} style={{
            background: "rgba(255,255,255,0.08)", border: `1px solid rgba(255,255,255,0.12)`,
            color: colors.text, padding: "6px 12px", borderRadius: 6, cursor: "pointer",
            fontSize: 12, fontWeight: 600,
          }}>📊</button>
          <button onClick={() => setPhase(PHASES.SETTINGS)} style={{
            background: "rgba(255,255,255,0.08)", border: `1px solid rgba(255,255,255,0.12)`,
            color: colors.text, padding: "6px 12px", borderRadius: 6, cursor: "pointer",
            fontSize: 12, fontWeight: 600,
          }}>⚙️</button>
        </div>
      </div>

      {/* Dealer area */}
      <div style={{ textAlign: "center", padding: "24px 16px 12px", position: "relative", zIndex: 5 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
          Dealer {dealerCards.length > 0 && `• ${dealerRevealed ? handValue(dealerCards).total : cardValue(dealerCards[0]?.rank)}`}
          {dealerRevealed && handValue(dealerCards).bust && " • BUST"}
        </div>
        <div style={{ display: "flex", justifyContent: "center", minHeight: 110, alignItems: "center" }}>
          {dealerCards.map((c, i) => (
            <Card key={c.id} card={c} hidden={i === 1 && !dealerRevealed} dealt={cardsDealt[c.id]} />
          ))}
        </div>
      </div>

      {/* Result message */}
      {isResult && (
        <div style={{
          textAlign: "center", padding: "8px 0",
          fontSize: 28, fontWeight: 900, color: resultColor,
          fontFamily: "'Playfair Display', serif",
          textShadow: `0 2px 20px ${resultColor}44`,
          animation: "pulse 0.6s ease",
          position: "relative", zIndex: 5,
        }}>{resultMsg}</div>
      )}

      {/* Player area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 5 }}>
        {playerHands.map((hand, hi) => {
          const hv = handValue(hand);
          const isActive = hi === activeHandIndex && isPlaying;
          return (
            <div key={hi} style={{
              marginBottom: 8, textAlign: "center",
              opacity: isPlaying && hi !== activeHandIndex ? 0.5 : 1,
              transform: isActive ? "scale(1.02)" : "scale(1)",
              transition: "all 0.2s ease",
            }}>
              {playerHands.length > 1 && (
                <div style={{ fontSize: 10, color: colors.goldDim, letterSpacing: 1, marginBottom: 4 }}>
                  HAND {hi + 1} • ${handBets[hi]}
                  {handResults[hi] && ` • ${handResults[hi].result.toUpperCase()}`}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                {hand.map(c => (
                  <Card key={c.id} card={c} dealt={cardsDealt[c.id]} />
                ))}
              </div>
              <div style={{
                fontSize: 14, marginTop: 6, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: hv.bust ? colors.red : hv.blackjack ? colors.gold : "rgba(255,255,255,0.7)",
              }}>
                {hv.soft && !hv.blackjack && `Soft `}{hv.blackjack ? "Blackjack!" : hv.total}
                {hv.bust && " BUST"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Strategy advisor */}
      {showAdvisor && isPlaying && optimal && (
        <div style={{
          margin: "0 16px 8px", padding: "10px 14px", borderRadius: 10,
          background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)",
          border: `1px solid ${colors.goldDim}33`,
          textAlign: "center", position: "relative", zIndex: 5,
        }}>
          <span style={{ fontSize: 11, color: colors.goldDim, letterSpacing: 1, textTransform: "uppercase" }}>Advisor: </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: colors.goldLight }}>{optimal.action.toUpperCase()}</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginLeft: 8 }}>— {optimal.reason}</span>
        </div>
      )}

      {/* Action area */}
      <div style={{
        padding: "12px 16px 24px", background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)", borderTop: `1px solid rgba(212,168,67,0.1)`,
        position: "relative", zIndex: 10,
      }}>
        {/* Betting phase */}
        {isBetting && !sessionOver && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: colors.goldDim, letterSpacing: 2, textTransform: "uppercase" }}>Tap chips to stack your bet</span>
              <div style={{
                fontSize: 32, fontWeight: 900, color: currentBet > 0 ? colors.gold : colors.textDim,
                fontFamily: "'JetBrains Mono', monospace", marginTop: 4,
              }}>${currentBet}</div>
              {consecutiveWins > 0 && (
                <div style={{ fontSize: 11, color: colors.green, marginTop: 2 }}>
                  🔥 Win streak: {consecutiveWins} — Suggested: ${suggestedBet()}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 10 }}>
              {[1, 5, 10, 25, 50, 100].map(v => (
                <Chip key={v} value={v}
                  disabled={currentBet + v > bankroll}
                  onClick={(val) => setCurrentBet(prev => Math.min(prev + val, bankroll))} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setCurrentBet(0)} style={{
                padding: "14px 0", borderRadius: 10, width: 80,
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                color: colors.textDim, fontWeight: 700, fontSize: 13, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}>CLEAR</button>
              <button onClick={startHand} disabled={currentBet === 0 || currentBet > bankroll} style={{
                flex: 1, padding: "14px 0", borderRadius: 10,
                background: currentBet > 0 ? `linear-gradient(135deg, ${colors.gold}, ${colors.goldDim})` : colors.surfaceLight,
                border: "none", color: currentBet > 0 ? colors.bg : colors.textDim,
                fontWeight: 800, fontSize: 15, cursor: currentBet > 0 ? "pointer" : "not-allowed",
                fontFamily: "'DM Sans', sans-serif", letterSpacing: 1,
              }}>DEAL</button>
            </div>
          </div>
        )}

        {/* Session over */}
        {isBetting && sessionOver && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 22, fontWeight: 900, marginBottom: 8,
              fontFamily: "'Playfair Display', serif",
              color: bankroll >= initialBankroll * 2 ? colors.gold : colors.red,
            }}>
              {bankroll >= initialBankroll * 2 ? "🎉 TARGET HIT — WALK AWAY!" : "Session Over — Bankroll Empty"}
            </div>
            <div style={{ fontSize: 14, color: colors.textDim, marginBottom: 16 }}>
              {handsPlayed} hands played • Final: ${bankroll.toFixed(0)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPhase(PHASES.ANALYTICS)} style={{
                flex: 1, padding: "12px 0", borderRadius: 10,
                background: colors.surfaceLight, border: `1px solid ${colors.goldDim}33`,
                color: colors.text, fontWeight: 700, cursor: "pointer",
              }}>View Analytics</button>
              <button onClick={() => {
                setBankroll(initialBankroll);
                setBankrollHistory([initialBankroll]);
                setPhase(PHASES.SETTINGS);
              }} style={{
                flex: 1, padding: "12px 0", borderRadius: 10,
                background: `linear-gradient(135deg, ${colors.gold}, ${colors.goldDim})`,
                border: "none", color: colors.bg, fontWeight: 800, cursor: "pointer",
              }}>New Session</button>
            </div>
          </div>
        )}

        {/* Playing phase */}
        {isPlaying && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={handleHit} style={{
              flex: 1, padding: "14px 0", borderRadius: 10, maxWidth: 120,
              background: optimal?.action === "hit" ? colors.green : "rgba(255,255,255,0.1)",
              border: optimal?.action === "hit" ? "none" : "1px solid rgba(255,255,255,0.15)",
              color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
            }}>HIT</button>
            <button onClick={handleStand} style={{
              flex: 1, padding: "14px 0", borderRadius: 10, maxWidth: 120,
              background: optimal?.action === "stand" ? colors.red : "rgba(255,255,255,0.1)",
              border: optimal?.action === "stand" ? "none" : "1px solid rgba(255,255,255,0.15)",
              color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
            }}>STAND</button>
            {canDouble() && (
              <button onClick={handleDouble} style={{
                flex: 1, padding: "14px 0", borderRadius: 10, maxWidth: 120,
                background: optimal?.action === "double" ? colors.gold : "rgba(255,255,255,0.1)",
                border: optimal?.action === "double" ? "none" : "1px solid rgba(255,255,255,0.15)",
                color: optimal?.action === "double" ? colors.bg : "white",
                fontWeight: 800, fontSize: 14, cursor: "pointer",
              }}>DOUBLE</button>
            )}
            {canSplit() && (
              <button onClick={handleSplit} style={{
                flex: 1, padding: "14px 0", borderRadius: 10, maxWidth: 120,
                background: optimal?.action === "split" ? colors.blue : "rgba(255,255,255,0.1)",
                border: optimal?.action === "split" ? "none" : "1px solid rgba(255,255,255,0.15)",
                color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
              }}>SPLIT</button>
            )}
          </div>
        )}

        {/* Dealer phase */}
        {phase === PHASES.DEALER && (
          <div style={{ textAlign: "center", padding: "14px 0", color: colors.goldDim, fontSize: 14, letterSpacing: 2 }}>
            DEALER PLAYING...
          </div>
        )}

        {/* Result phase */}
        {isResult && (
          <div>
            <button onClick={() => {
              setCurrentBet(Math.min(suggestedBet(), bankroll));
              setPlayerHands([[]]);
              setDealerCards([]);
              setHandResults([]);
              setActiveHandIndex(0);
              setPhase(PHASES.BETTING);
            }} style={{
              width: "100%", padding: "14px 0", borderRadius: 10,
              background: `linear-gradient(135deg, ${colors.gold}, ${colors.goldDim})`,
              border: "none", color: colors.bg, fontWeight: 800, fontSize: 15,
              cursor: "pointer", letterSpacing: 1,
            }}>NEXT HAND</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0% { transform: scale(0.9); opacity: 0; } 50% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${colors.goldDim}44; border-radius: 4px; }
      `}</style>
    </div>
  );
}
